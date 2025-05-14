import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import axios from '../axios'; // Votre instance axios configurée
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext.jsx'; // Supposons que vous ayez un AuthContext

// --- Icônes (Garder Material UI ou remplacer par SVG/autre) ---
import LogoutIcon from '@mui/icons-material/Logout';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility'; // Pour "Voir"
import MenuIcon from '@mui/icons-material/Menu'; // Pour le toggle sidebar (si ajouté)
import EventIcon from '@mui/icons-material/Event'; // Pour la section RDV

// --- Notifications Toast (Garder) ---
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Importer le CSS partagé ---
import './dashboard.css'; // Assurez-vous que ce fichier contient les styles nécessaires

// --- API Client (Réutilisé) ---
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json' } // Content-Type géré par requête si nécessaire
});
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
}, error => Promise.reject(error));
// --- Fin API Client ---

// --- Composant Modal Personnalisé (Réutilisé ou adapté) ---
const FormModal = ({ isOpen, onClose, onSubmit, title, children, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false }) => {
    if (!isOpen) return null;
    return (
        <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Taille par défaut */}
                {title && <h3 className="modal-title">{title}</h3>}
                <div className="modal-body">
                    {children} {/* Le contenu du formulaire (input fichier) sera ici */}
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button cancel-button" disabled={isLoading}>{cancelText}</button>
                    <button onClick={onSubmit} className="modal-button confirm-button" disabled={isLoading}>
                        {isLoading ? (<div className="button-spinner"></div>) : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Composant Modal de Confirmation (Si nécessaire pour la suppression) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false }) => {
    if (!isOpen) return null;
    return (
        <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {title && <h3 className="modal-title">{title}</h3>}
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button cancel-button" disabled={isLoading}>{cancelText}</button>
                    <button onClick={onConfirm} className="modal-button confirm-button button-danger" disabled={isLoading}> {/* Style danger */}
                        {isLoading ? (<div className="button-spinner"></div>) : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


function CliniqueDashboard() {
    const navigate = useNavigate();
    // Utiliser AuthContext si disponible, sinon gérer le logout localement
    const { logout: contextLogout } = useContext(AuthContext) || {}; // Utiliser || {} pour éviter l'erreur si AuthContext n'est pas fourni

    // États du composant
    const [appointments, setAppointments] = useState([]);
    const [pagination, setPagination] = useState({ page: 0, rowsPerPage: 10, total: 0 });
    const rowsPerPageOptions = useMemo(() => [5, 10, 25], []); // Options pour la pagination
    const [loading, setLoading] = useState({ auth: true, data: false, upload: false, delete: false }); // Ajouter 'delete'
    const [error, setError] = useState({ general: null, data: null, upload: null, delete: null }); // Structurer les erreurs
    const [userName, setUserName] = useState('');
    const [cliniqueId, setCliniqueId] = useState(null);

    // États pour les modales
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadAppointmentId, setUploadAppointmentId] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); // État pour la modale de suppression
    const [deleteAppointmentId, setDeleteAppointmentId] = useState(null); // ID pour la suppression

    // États pour la barre latérale (si ajoutée)
    const [sidebarOpen, setSidebarOpen] = useState(false); // Optionnel: pour une barre latérale
    const [activeSection, setActiveSection] = useState('appointments'); // Section par défaut

    // Récupération des rendez-vous (adaptée pour la pagination locale)
    const fetchAppointments = useCallback(async (page = 0, limit = 10) => {
        setLoading(prev => ({ ...prev, data: true }));
        setError(prev => ({ ...prev, data: null })); // Réinitialiser l'erreur data
        try {
            const apiPage = page + 1; // L'API utilise une pagination basée sur 1
            const response = await apiClient.get(`/clinique/appointments?page=${apiPage}&limit=${limit}`);

            const appointmentsData = response.data?.data || [];
            const totalRows = response.data?.total || 0;
            const currentPageApi = response.data?.current_page || 1;
            const perPageApi = response.data?.per_page || limit;

            let newRowsPerPage = rowsPerPageOptions.includes(Number(perPageApi))
                ? Number(perPageApi)
                : rowsPerPageOptions.includes(Number(limit)) ? Number(limit) : rowsPerPageOptions[0];

            setAppointments(appointmentsData);
            setPagination({
                page: currentPageApi - 1, // Mettre à jour la page locale (basée sur 0)
                rowsPerPage: newRowsPerPage,
                total: totalRows
            });

        } catch (err) {
            console.error("Échec du chargement des rendez-vous (Clinique):", err);
            const message = err.response?.status === 401
                ? 'Session expirée. Veuillez vous reconnecter.'
                : 'Échec du chargement des rendez-vous.';
            setError(prev => ({ ...prev, data: message }));
            toast.error(message);
            setAppointments([]); // Vider en cas d'erreur
            setPagination(prev => ({ ...prev, total: 0, page: 0 })); // Réinitialiser la pagination
        } finally {
            setLoading(prev => ({ ...prev, data: false }));
        }
    }, [rowsPerPageOptions]); // Dépendance: options par page

    // Vérification de l'authentification et récupération initiale
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null })); // Réinitialiser erreur générale
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login'); return;
            }
            try {
                const response = await apiClient.get('/user');
                const isClinique = response.data?.roles?.some(r => r.name === 'clinique') || response.data?.role === 'clinique';
                if (!isClinique) {
                    setError(prev => ({ ...prev, general: 'Accès Refusé : Rôle clinique requis.' }));
                    navigate('/login'); // Ou une page d'erreur appropriée
                    return;
                }
                setUserName(response.data.name || 'Clinique');
                setCliniqueId(response.data.id); // Important pour Pusher
                console.log("✅ ID Clinique défini :", response.data.id);
                // Charger les données initiales avec la pagination par défaut
                fetchAppointments(pagination.page, pagination.rowsPerPage);
            } catch (err) {
                console.error("Échec de la vérification d'authentification (Clinique):", err);
                const message = err.response?.status === 401
                    ? 'Session expirée. Veuillez vous reconnecter.'
                    : 'Échec de l\'authentification. Veuillez vous reconnecter.';
                setError(prev => ({ ...prev, general: message }));
                handleLogout(); // Déconnecter en cas d'erreur
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Exécuter seulement au montage

    // Recharger les RDV quand la page ou la limite change (déclenché par les contrôles de pagination)
    useEffect(() => {
        // Ne recharger que si l'authentification est terminée et qu'on n'est pas déjà en train de charger
        if (!loading.auth && cliniqueId) {
            fetchAppointments(pagination.page, pagination.rowsPerPage);
        }
        // Dépendances : page, rowsPerPage, cliniqueId (pour s'assurer qu'il est défini)
    }, [pagination.page, pagination.rowsPerPage, cliniqueId, fetchAppointments, loading.auth]);


    // Écouteur Pusher/Echo
    useEffect(() => {
        if (!window.Echo || !cliniqueId) {
            console.log("⏳ Echo ou ID Clinique non prêt", { EchoExists: !!window.Echo, cliniqueId });
            return; // Attendre que Echo et cliniqueId soient disponibles
        }

        const channelName = `clinique.${cliniqueId}`;
        console.log(`📡 Abonnement au canal ${channelName}`);

        const clinicChannel = window.Echo.private(channelName);

        clinicChannel
            .subscribed(() => {
                console.log(`✅ Abonné à ${channelName}`);
            })
            .error(error => {
                console.error(`❌ Erreur d'abonnement à ${channelName}:`, error);
            })
            .listen('.appointment.created', (event) => {
                console.log('📣 [clinique] Rendez-vous créé:', event);
                // Utiliser les données de l'événement pour le message
                const patientName = `${event.appointment?.patient?.name || ''} ${event.appointment?.patient?.last_name || ''}`.trim() || 'un patient';
                const dateRdv = event.appointment?.date_du_rdv ? new Date(event.appointment.date_du_rdv).toLocaleDateString('fr-FR') : 'une date future';
                toast.info(`🧾 Nouveau RDV pour ${patientName} le ${dateRdv}`);
                // Recharger la page actuelle pour voir le nouveau RDV
                fetchAppointments(pagination.page, pagination.rowsPerPage);
            })
            .listen('.quote.sent.to.patient', (event) => {
                console.log('📣 [clinique] Devis envoyé au patient:', event);
                const patientName = `${event.quote?.patient?.name || ''} ${event.quote?.patient?.last_name || ''}`.trim() || 'un patient';
                toast.info(`📨 Un devis a été envoyé au patient ${patientName}.`);
                fetchAppointments(pagination.page, pagination.rowsPerPage);
            })
            .listen('.appointment.status.updated', (event) => {
                console.log('📣 [clinique] Statut de RDV mis à jour:', event);
                const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'un patient';
                const newStatus = event.status || 'inconnu';
                toast.info(`🔁 Statut du RDV de ${patientName} mis à jour : ${newStatus}`);
                fetchAppointments(pagination.page, pagination.rowsPerPage); // Refresh data
            });


        // Nettoyage : quitter le canal
        return () => {
            console.log(`👋 Quitte le canal ${channelName}`);
            window.Echo.leave(channelName);
        };
    }, [cliniqueId, fetchAppointments, pagination.page, pagination.rowsPerPage]); // Dépendances : ID clinique et fonction fetch

    // Gestion de la déconnexion
    const handleLogout = async () => {
        if (contextLogout) {
            contextLogout(); // Utiliser la fonction du contexte si elle existe
        } else {
            // Logique de déconnexion locale si pas de contexte
            try {
                await apiClient.post('/logout'); // Informer le backend
            } catch (error) {
                console.error("Erreur lors de la déconnexion backend:", error);
                // Continuer la déconnexion côté client même si le backend échoue
            } finally {
                localStorage.removeItem('token'); // Supprimer le token local
                navigate('/login'); // Rediriger vers la connexion
            }
        }
    };

    // Ouvrir la modale d'upload
    const openUploadDialog = (appointmentId) => {
        setUploadAppointmentId(appointmentId);
        setSelectedFile(null); // Réinitialiser le fichier sélectionné
        setError(prev => ({ ...prev, upload: null })); // Effacer l'erreur d'upload précédente
        setUploadDialogOpen(true);
    };
    // Fermer la modale d'upload
    const closeUploadDialog = () => {
        setUploadDialogOpen(false);
        // Réinitialiser après fermeture (avec délai pour animation)
        setTimeout(() => {
            setSelectedFile(null);
            setUploadAppointmentId(null);
            setLoading(prev => ({ ...prev, upload: false }));
        }, 300);
    };

    // Gérer la sélection de fichier
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        // Optionnel: Ajouter une validation de type/taille ici si nécessaire
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            setError(prev => ({ ...prev, upload: null })); // Effacer l'erreur si fichier valide
        } else if (file) {
            setSelectedFile(null); // Refuser le fichier
            setError(prev => ({ ...prev, upload: 'Veuillez sélectionner un fichier PDF.' }));
            toast.warn('Veuillez sélectionner un fichier PDF.');
        }
    };

    // Gérer l'upload du fichier
    const handleFileUpload = async () => {
        if (!selectedFile || !uploadAppointmentId) {
            toast.warn("Veuillez sélectionner un fichier à téléverser.");
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile); // 'file' doit correspondre au nom attendu par l'API

        setLoading(prev => ({ ...prev, upload: true }));
        setError(prev => ({ ...prev, upload: null })); // Effacer l'erreur avant l'envoi

        try {
            // Utiliser apiClient configuré (qui a déjà l'intercepteur)
            await apiClient.post(
                `/clinique/appointments/${uploadAppointmentId}/upload-quote`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } } // Important pour FormData
            );
            toast.success('Devis téléversé avec succès !');
            closeUploadDialog(); // Fermer la modale
            // Recharger les données pour voir le lien/statut mis à jour
            fetchAppointments(pagination.page, pagination.rowsPerPage);
        } catch (err) {
            console.error("Échec du téléversement du devis:", err.response?.data || err.message);
            const errorMsg = `Échec du téléversement : ${err.response?.data?.message || 'Une erreur est survenue.'}`;
            setError(prev => ({ ...prev, upload: errorMsg })); // Afficher l'erreur dans la modale
            toast.error(errorMsg);
        } finally {
            setLoading(prev => ({ ...prev, upload: false })); // Arrêter le spinner du bouton
        }
    };

    // Ouvrir la modale de confirmation de suppression
    const openDeleteDialog = (appointmentId) => {
        setDeleteAppointmentId(appointmentId);
        setError(prev => ({ ...prev, delete: null })); // Effacer erreur précédente
        setDeleteDialogOpen(true);
    };
    // Fermer la modale de confirmation de suppression
    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setTimeout(() => {
            setDeleteAppointmentId(null);
            setLoading(prev => ({ ...prev, delete: false }));
        }, 300);
    };

    // Gérer la suppression du devis
    const handleDeleteQuote = async () => {
        if (!deleteAppointmentId) return;

        setLoading(prev => ({ ...prev, delete: true }));
        setError(prev => ({ ...prev, delete: null }));

        try {
            await apiClient.delete(`/clinique/appointments/${deleteAppointmentId}/delete-quote`);
            toast.success("Devis supprimé avec succès !");
            closeDeleteDialog(); // Fermer la modale de confirmation
            // Recharger les données
            fetchAppointments(pagination.page, pagination.rowsPerPage);
        } catch (err) {
            console.error("Échec de la suppression du devis:", err.response?.data || err.message);
            const errorMsg = `Échec de la suppression : ${err.response?.data?.message || 'Une erreur est survenue.'}`;
            setError(prev => ({ ...prev, delete: errorMsg })); // Afficher dans la modale si elle reste ouverte, sinon toast
            toast.error(errorMsg);
        } finally {
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    // Gérer le changement de page
    const handleChangePage = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        // fetchAppointments(newPage, pagination.rowsPerPage); // Déclenché par useEffect
    };

    // Gérer le changement du nombre de lignes par page
    const handleChangeRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        setPagination(prev => ({ ...prev, rowsPerPage: newLimit, page: 0 })); // Revenir à la page 0
        // fetchAppointments(0, newLimit); // Déclenché par useEffect
    };

    // Fonction utilitaire pour formater la date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('fr-FR', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) { return 'Date Invalide'; }
    };

    // --- Logique de Rendu ---

    // État de Chargement Initial (Authentification)
    if (loading.auth) {
        return (
            <div className="loading-container dashboard-body">
                <div className="simple-spinner"></div>
                <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Vérification de l'accès...</p>
            </div>
        );
    }

    // État d'Erreur Générale (Authentification / Accès)
    if (error.general) {
        return (
            <div className="error-container dashboard-body">
                <p>{error.general}</p>
                <button onClick={() => navigate('/login')} className="action-button">Aller à la Connexion</button>
            </div>
        );
    }

    // Calcul pour la pagination
    const totalPages = Math.ceil(pagination.total / pagination.rowsPerPage);

    return (
        <> {/* Fragment React */}
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            <div className="dashboard-body">
                {/* En-tête */}
                <header className="dashboard-header">
                    {/* Optionnel: Bouton Menu pour Sidebar */}
                    {/* <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu">
                        <MenuIcon />
                    </button> */}
                    <div className="header-title">Tableau de Bord Clinique ({userName})</div>
                    <div className="header-actions">
                        <button onClick={handleLogout} className="action-button button-outline">
                            <LogoutIcon fontSize="small" style={{ marginRight: '5px' }} /> Déconnexion
                        </button>
                    </div>
                </header>

                {/* Wrapper Contenu Principal (Optionnel si pas de sidebar) */}
                <div className="main-content-wrapper no-sidebar"> {/* Ajouter 'no-sidebar' si pas de barre latérale */}
                    {/* Barre Latérale (Optionnelle) */}
                    {/* <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                        <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setActiveSection('appointments')}>
                            <EventIcon /> Rendez-vous
                        </button>
                    </aside> */}

                    {/* Zone de Contenu Principal */}
                    <main className="content-area">
                        {/* Overlay pour fermer la barre latérale sur mobile (si sidebar existe) */}
                        {/* {sidebarOpen && <div className="content-overlay" onClick={() => setSidebarOpen(false)}></div>} */}

                        {/* Section Rendez-vous */}
                        {activeSection === 'appointments' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><EventIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Rendez-vous</h3>
                                    {/* Ajouter des filtres ou actions ici si nécessaire */}
                                </div>

                                {error.data && <div className="alert-message alert-message-warning"><span>{error.data}</span></div>}

                                <div className="table-container responsive">
                                    <table className="styled-table">
                                        <thead>
                                            <tr>
                                                <th>Patient</th>
                                                <th>Agent</th>
                                                <th>Date & Heure</th>
                                                <th>Service</th>
                                                <th style={{ textAlign: 'center' }}>Devis</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading.data ? (
                                                // Indicateur de chargement dans le tableau
                                                Array.from(new Array(pagination.rowsPerPage)).map((_, index) => (
                                                    <tr key={`loading-${index}`}>
                                                        <td colSpan="6"><div className="skeleton-text"></div></td>
                                                    </tr>
                                                ))
                                            ) : appointments.length > 0 ? appointments.map((appt) => (
                                                <tr key={appt.id}>
                                                    <td>{appt.patient?.name} {appt.patient?.last_name || ''}</td>
                                                    <td>{appt.agent?.name} {appt.agent?.last_name || ''}</td>
                                                    <td>{formatDate(appt.date_du_rdv)}</td>
                                                    <td>{appt.service || 'N/A'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {appt.file_url ? (
                                                            <span className="status-badge confirmed">Envoyé</span>
                                                        ) : (
                                                            <span className="status-badge pending">En attente</span>
                                                        )}
                                                    </td>
                                                    <td className="action-cell"> {/* Classe pour aligner les boutons */}
                                                        {appt.file_url ? (
                                                            <>
                                                                <a href={appt.file_url} target="_blank" rel="noopener noreferrer" className="action-button-icon" title="Voir le Devis">
                                                                    <VisibilityIcon fontSize="small" />
                                                                </a>
                                                                <button onClick={() => openDeleteDialog(appt.id)} className="action-button-icon button-danger" title="Supprimer le Devis" disabled={loading.delete}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button onClick={() => openUploadDialog(appt.id)} className="action-button-icon" title="Téléverser un Devis" disabled={loading.upload}>
                                                                <UploadFileIcon fontSize="small" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>Aucun rendez-vous trouvé.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Personnalisée */}
                                {pagination.total > 0 && (
                                    <div className="pagination-controls">
                                        {/* Select pour lignes par page */}
                                        <div className="form-group inline">
                                            <label htmlFor="rows-per-page">Lignes par page :</label>
                                            <select id="rows-per-page" value={pagination.rowsPerPage} onChange={handleChangeRowsPerPage} disabled={loading.data}>
                                                {rowsPerPageOptions.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Indicateur de page */}
                                        <span className="page-indicator">
                                            Page {pagination.page + 1} sur {totalPages} ({pagination.total} total)
                                        </span>

                                        {/* Boutons Précédent/Suivant */}
                                        <div className="pagination-buttons">
                                            <button
                                                onClick={() => handleChangePage(pagination.page - 1)}
                                                disabled={pagination.page === 0 || loading.data}
                                                className="action-button button-outline button-small"
                                            >
                                                Précédent
                                            </button>
                                            <button
                                                onClick={() => handleChangePage(pagination.page + 1)}
                                                disabled={pagination.page >= totalPages - 1 || loading.data}
                                                className="action-button button-outline button-small"
                                            >
                                                Suivant
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                    </main> {/* Fin Zone Contenu */}
                </div> {/* Fin Wrapper Contenu Principal */}
            </div> {/* Fin Dashboard Body */}

            {/* Modale Upload Devis */}
            <FormModal
                isOpen={uploadDialogOpen}
                onClose={closeUploadDialog}
                onSubmit={handleFileUpload}
                title="Envoyer un Devis PDF"
                confirmText="Envoyer"
                cancelText="Annuler"
                isLoading={loading.upload}
            >
                {/* Afficher l'erreur d'upload ici */}
                {error.upload && <div className="alert-message alert-message-error" style={{ marginBottom: '15px' }}><span>{error.upload}</span></div>}

                {/* Input fichier stylisé */}
                <div className="form-group">
                    <label htmlFor="quote-file-input" className="file-input-label">
                        {selectedFile ? selectedFile.name : "Choisir un fichier PDF..."}
                    </label>
                    <input
                        type="file"
                        id="quote-file-input"
                        accept=".pdf" // Accepter seulement les PDF
                        onChange={handleFileChange}
                        style={{ display: 'none' }} // Cacher l'input par défaut
                    />
                    {/* Afficher un aperçu ou une indication du fichier sélectionné */}
                    {selectedFile && <span className="file-name-display">Fichier sélectionné : {selectedFile.name}</span>}
                </div>
            </FormModal>

            {/* Modale Confirmation Suppression */}
            <ConfirmationModal
                isOpen={deleteDialogOpen}
                onClose={closeDeleteDialog}
                onConfirm={handleDeleteQuote}
                title="Confirmer la Suppression"
                message="Êtes-vous sûr de vouloir supprimer ce devis ? Cette action est irréversible."
                confirmText="Oui, Supprimer"
                cancelText="Annuler"
                isLoading={loading.delete}
            />
        </>
    );
}

export default CliniqueDashboard;
