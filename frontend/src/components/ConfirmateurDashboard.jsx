import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import axios from '../axios'; // Votre instance axios configurée
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext.jsx'; // Supposons un AuthContext

// --- Icônes (Remplacer Material UI) ---
// Utiliser des SVG en ligne, FontAwesome, ou du texte/symboles si les icônes MUI sont supprimées
// Exemple (à adapter ou utiliser des SVG/bibliothèque d'icônes) :
const LogoutIcon = () => <svg /* ... */ > {/* SVG pour déconnexion */} </svg>;
const CheckCircleIcon = () => '✓'; // Symbole simple
const CancelIcon = () => '✕';     // Symbole simple
const EmailIcon = () => '📧';      // Emoji
const SmsIcon = () => '💬';        // Emoji
const PhoneIcon = () => '📞';      // Emoji
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>; // Exemple SVG Menu


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

// --- Composant Modal de Confirmation (Similaire aux autres dashboards) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false, children, confirmButtonClass = 'confirm-button' }) => {
    if (!isOpen) return null;
    return (
        <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {title && <h3 className="modal-title">{title}</h3>}
                <p className="modal-message">{message}</p>
                {children && <div className="modal-body">{children}</div>}
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button cancel-button" disabled={isLoading}>{cancelText}</button>
                    <button onClick={onConfirm} className={`modal-button ${confirmButtonClass}`} disabled={isLoading}>
                        {isLoading ? (<div className="button-spinner"></div>) : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Composant Principal ConfirmateurDashboard ---
function ConfirmateurDashboard() {
    const navigate = useNavigate();
    // Utiliser AuthContext si disponible
    const { logout: contextLogout } = useContext(AuthContext) || {};

    // --- États des Données ---
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const [appointments, setAppointments] = useState([]);

    // --- États de Pagination ---
    const [appointmentPage, setAppointmentPage] = useState(0);
    const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10);
    const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
    const appointmentRowsPerPageOptions = useMemo(() => [10, 20, 50], []);

    // --- États de Filtre ---
    const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('pending'); // Défaut: en attente

    // --- États UI / Formulaire ---
    const [loading, setLoading] = useState({ appointments: false, auth: true, action: false });
    const [error, setError] = useState({ appointments: null, general: null });
    const [sidebarOpen, setSidebarOpen] = useState(false); // Pour la barre latérale responsive

    // --- Modale de Mise à Jour Statut ---
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [currentAppointmentForStatus, setCurrentAppointmentForStatus] = useState(null); // {id, name, currentStatus, targetStatus, date}


    // --- Autorisation et Récupération Initiale des Données ---
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const response = await apiClient.get('/user');
                const isConfirmateur = response.data?.roles?.some(role => role.name === 'confirmateur') || response.data?.role === 'confirmateur';

                if (isConfirmateur) {
                    setUserRole('confirmateur');
                    setUserName(response.data?.name || 'Confirmateur');
                    // Récupérer les données initiales (par défaut 'pending')
                    fetchAppointments(0, appointmentRowsPerPage, 'pending');
                } else {
                    const userRoleDetected = response.data?.roles?.[0]?.name || response.data?.role;
                    setError(prev => ({ ...prev, general: 'Accès Refusé : Rôle confirmateur requis.' }));
                    navigate(userRoleDetected === 'administrateur' ? '/dashboard' : userRoleDetected === 'superviseur' ? '/supervisor-dashboard' : userRoleDetected === 'agent' ? '/agent-dashboard' : '/login');
                }
            } catch (err) {
                console.error("Échec de la vérification d'authentification:", err);
                const message = err.response?.status === 401 ? 'Session expirée. Veuillez vous reconnecter.' : 'Échec de l\'authentification. Veuillez vous reconnecter.';
                setError(prev => ({ ...prev, general: message }));
                handleLogout();
            } finally { setLoading(prev => ({ ...prev, auth: false })); }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Exécuter une seule fois

    // --- Récupération des Rendez-vous ---
    const fetchAppointments = useCallback(async (page = 0, limit = 10, status = '') => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const apiPage = page + 1;
            let url = `/confirmateur/appointments?page=${apiPage}&limit=${limit}`;
            if (status) {
                url += `&status=${status}`;
            }

            const response = await apiClient.get(url);

            let apiPerPageAppt = response.data.per_page;
            let newRowsPerPageAppt = appointmentRowsPerPageOptions.includes(Number(apiPerPageAppt))
                ? Number(apiPerPageAppt)
                : appointmentRowsPerPageOptions.includes(Number(limit)) ? Number(limit) : appointmentRowsPerPageOptions[0];

            setAppointments(response.data.data || []);
            setAppointmentTotalRows(response.data.total || 0);
            setAppointmentPage(response.data.current_page ? response.data.current_page - 1 : 0);
            setAppointmentRowsPerPage(newRowsPerPageAppt);
        } catch (err) {
            console.error("Échec de la récupération des RDV (Confirmateur):", err);
            setError(prev => ({ ...prev, appointments: 'Échec du chargement des rendez-vous.' }));
            setAppointments([]); setAppointmentTotalRows(0);
            toast.error('Impossible de charger les rendez-vous.');
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, [appointmentRowsPerPageOptions]); // Dépendance

    // --- Écouteur Pusher/Echo ---
    useEffect(() => {
        if (!window.Echo || userRole !== 'confirmateur') return;

        // Utiliser un canal spécifique au rôle si possible, sinon un canal plus général
        // const channelName = `role.confirmateur`; // Ou un autre canal pertinent
        const channelName = `role.confirmateur`; // Assumons ce canal pour l'exemple
        console.log(`📡 Abonnement au canal Pusher : ${channelName}`);

        const confirmateurChannel = window.Echo.private(channelName);

        confirmateurChannel
            .subscribed(() => {
                console.log(`✅ Abonné avec succès à ${channelName}`);
            })
            .error(error => {
                console.error(`❌ Erreur d'abonnement au canal Pusher ${channelName}:`, error);
            })
            .listen('.appointment.created', (event) => {
                console.log('📣 [Confirmateur] Événement RDV créé reçu:', event);
                const agentName = `${event.agent?.name || ''} ${event.agent?.last_name || ''}`.trim() || 'un agent';
                const date = event.appointment?.date_du_rdv ? new Date(event.appointment.date_du_rdv).toLocaleDateString('fr-FR') : 'une date';
                toast.info(`📅 Nouveau RDV créé par ${agentName} le ${date}`);
                // Recharger si nécessaire (par exemple, si le filtre est 'tous' ou 'en attente')
                if (appointmentStatusFilter === '' || appointmentStatusFilter === 'pending') {
                    fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
                }
            })
            // Ajouter d'autres écouteurs si nécessaire (ex: .appointment.updated)
            ;

        return () => {
            console.log(`👋 Quitte le canal Pusher ${channelName}`);
            window.Echo.leave(channelName);
        };
    }, [userRole, fetchAppointments, appointmentPage, appointmentRowsPerPage, appointmentStatusFilter]); // Dépendances

    // --- Effet pour recharger sur changement de filtre/page ---
    useEffect(() => {
        if (userRole === 'confirmateur') {
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        }
    }, [appointmentStatusFilter, appointmentPage, appointmentRowsPerPage, userRole, fetchAppointments]);


    // --- Gestionnaires d'Actions ---

    // Mise à jour du statut
    const handleStatusUpdate = async () => {
        if (!currentAppointmentForStatus || !currentAppointmentForStatus.targetStatus) return;
        setLoading(prev => ({ ...prev, action: true }));

        const { id, targetStatus } = currentAppointmentForStatus;

        try {
            await apiClient.patch(`/confirmateur/appointments/${id}/status`, { status: targetStatus });
            closeStatusDialog();
            toast.success(`Statut du RDV mis à jour à ${translateStatus(targetStatus)}.`);
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        } catch (err) {
             console.error("Échec de la mise à jour du statut:", err.response?.data);
             toast.error(`Échec mise à jour statut: ${err.response?.data?.message || 'Erreur serveur'}`);
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };

    // Log de communication (Simulation)
    const handleLogCommunication = async (appointmentId, type) => {
        if (loading.action) return;
        setLoading(prev => ({ ...prev, action: true }));

        const endpoint = type === 'email'
            ? `/confirmateur/appointments/${appointmentId}/send-confirmation-email`
            : `/confirmateur/appointments/${appointmentId}/send-confirmation-sms`;

        const successMessage = type === 'email' ? 'Envoi Email enregistré (simulé).' : 'Envoi SMS enregistré (simulé).';
        const errorMessage = type === 'email' ? 'Échec enregistrement Email.' : 'Échec enregistrement SMS.';

         try {
            await apiClient.post(endpoint); // L'API gère la logique réelle
            toast.info(successMessage);
            // Optionnel: Mettre à jour l'UI si nécessaire (ex: date dernier contact)
        } catch (err) {
             console.error(`Échec enregistrement ${type}:`, err.response?.data);
             toast.error(`${errorMessage} ${err.response?.data?.message || ''}`);
        } finally {
             setLoading(prev => ({ ...prev, action: false }));
        }
    };

    // Déconnexion
    const handleLogout = useCallback(async () => {
        if (contextLogout) {
            contextLogout(); // Utiliser la fonction du contexte si disponible
        } else {
            try { await apiClient.post('/logout'); }
            catch (err) { console.error('Échec appel API Logout (ignoré):', err); }
            finally {
                localStorage.removeItem('token');
                setUserRole(null); setUserName('');
                setAppointments([]);
                setAppointmentPage(0); setAppointmentRowsPerPage(appointmentRowsPerPageOptions[0]);
                setError({ appointments: null, general: null });
                navigate('/login');
            }
        }
    }, [navigate, appointmentRowsPerPageOptions, contextLogout]);

    // --- Gestion des Modales ---
    const openStatusDialog = (appointment, targetStatus) => {
        setCurrentAppointmentForStatus({
            id: appointment.id,
            name: `${appointment.patient?.name || appointment.prenom_du_prospect || ''} ${appointment.patient?.last_name || appointment.nom_du_prospect || ''}`.trim(), // Nom Patient ou Prospect
            currentStatus: appointment.status,
            targetStatus: targetStatus,
            date: appointment.date_du_rdv
        });
        setIsStatusDialogOpen(true);
    };
    const closeStatusDialog = () => {
        setIsStatusDialogOpen(false);
        setTimeout(() => setCurrentAppointmentForStatus(null), 200);
    };

    // --- Gestionnaires de Pagination ---
    const handleChangeAppointmentPage = (newPage) => { setAppointmentPage(newPage); };
    const handleChangeAppointmentRowsPerPage = (event) => {
        setAppointmentRowsPerPage(parseInt(event.target.value, 10));
        setAppointmentPage(0);
    };

    // --- Fonctions Utilitaires ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('fr-FR', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) { return 'Date Invalide'; }
    };
    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'pending';
            case 'confirmed': return 'confirmed';
            case 'cancelled': return 'cancelled';
            default: return 'default';
        }
    };
    const translateStatus = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'En attente';
            case 'confirmed': return 'Confirmé';
            case 'cancelled': return 'Annulé';
            default: return status || 'N/A';
        }
    };

    // --- Logique de Rendu ---
    if (loading.auth) {
        return (
            <div className="loading-container dashboard-body">
                <div className="simple-spinner"></div>
                <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Vérification de l'accès...</p>
            </div>
        );
    }
    if (!userRole && !loading.auth) {
        return (
            <div className="error-container dashboard-body">
                <p>{error.general || 'Accès Refusé.'}</p>
                <button onClick={() => navigate('/login')} className="action-button">Aller à la Connexion</button>
            </div>
        );
    }

    const appointmentStatuses = ['pending', 'confirmed', 'cancelled']; // Statuts pour le filtre
    const totalPages = Math.ceil(appointmentTotalRows / appointmentRowsPerPage);

    // --- Rendu Principal du Composant ---
    return (
        <> {/* Fragment React */}
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            <div className="dashboard-body">
                {/* En-tête */}
                <header className="dashboard-header">
                    <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu">
                        <MenuIcon />
                    </button>
                    <div className="header-title">Tableau de Bord Confirmateur ({userName})</div>
                    <div className="header-actions">
                        <button onClick={handleLogout} className="action-button button-outline">
                            {/* Remplacer par SVG ou icône texte */}
                            <span style={{ marginRight: '5px' }}>⏏</span> Déconnexion
                        </button>
                    </div>
                </header>

                {/* Wrapper Contenu Principal */}
                <div className="main-content-wrapper">
                    {/* Barre Latérale (Optionnelle, peut être vide si non nécessaire) */}
                    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                         {/* Ajouter des liens de navigation si nécessaire */}
                         <button className={`sidebar-button active`} onClick={() => setSidebarOpen(false)}> {/* Exemple de bouton actif */}
                            🗓️ Rendez-vous
                        </button>
                    </aside>

                    {/* Zone de Contenu Principal */}
                    <main className="content-area">
                        {/* Overlay pour fermer la barre latérale sur mobile */}
                        {sidebarOpen && <div className="content-overlay" onClick={() => setSidebarOpen(false)}></div>}

                        {/* Affichage Erreur Générale */}
                        {error.general && (
                            <div className="alert-message alert-message-error">
                                <span>{error.general}</span>
                                <button className="alert-close-btn" onClick={() => setError(prev => ({ ...prev, general: null }))}>×</button>
                            </div>
                        )}

                        {/* Section Gestion des Rendez-vous */}
                        <section className="content-section">
                            <div className="section-header">
                                <h3>Rendez-vous à Confirmer</h3>
                                {/* Filtre Statut */}
                                <div className="form-group inline">
                                    <label htmlFor="appt-status-filter">Filtrer Statut :</label>
                                    <select
                                        id="appt-status-filter"
                                        value={appointmentStatusFilter}
                                        onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                                    >
                                        {/* Optionnel: <option value="">Tous</option> */}
                                        {appointmentStatuses.map(status => (
                                            <option key={status} value={status}>{translateStatus(status)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {error.appointments && <div className="alert-message alert-message-warning"><span>{error.appointments}</span></div>}

                            <div className="table-container responsive">
                                <table className="styled-table">
                                    <thead>
                                        <tr>
                                            <th>Patient</th>
                                            <th>Contact</th>
                                            <th>Date RDV</th>
                                            <th>Service</th>
                                            <th>Agent</th>
                                            <th>Statut</th>
                                            <th style={{ textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading.appointments ? (
                                            // Squelette simple pendant le chargement
                                            Array.from(new Array(appointmentRowsPerPage)).map((_, index) => (
                                                <tr key={`loading-${index}`}>
                                                    <td colSpan="7"><div className="skeleton-text"></div></td>
                                                </tr>
                                            ))
                                        ) : appointments.length > 0 ? appointments.map((appt) => (
                                            <tr key={appt.id}>
                                                <td>
                                                    {appt.patient ? `${appt.patient.name} ${appt.patient.last_name}` : `${appt.prenom_du_prospect} ${appt.nom_du_prospect}`}
                                                </td>
                                                <td>
                                                    {appt.patient?.telephone && (
                                                        <a href={`tel:${appt.patient.telephone}`} className="contact-link">
                                                            <PhoneIcon /> {appt.patient.telephone}
                                                        </a>
                                                    )}
                                                    {appt.patient?.email && (
                                                        <a href={`mailto:${appt.patient.email}`} className="contact-link">
                                                            <EmailIcon /> {appt.patient.email}
                                                        </a>
                                                    )}
                                                    {!appt.patient?.telephone && !appt.patient?.email && 'N/A'}
                                                </td>
                                                <td>{formatDate(appt.date_du_rdv)}</td>
                                                <td>{appt.service || 'N/A'}</td>
                                                <td>{appt.agent?.name ? `${appt.agent.name} ${appt.agent.last_name}` : 'N/A'}</td>
                                                <td>
                                                    <span className={`status-badge ${getStatusClass(appt.status)}`}>{translateStatus(appt.status)}</span>
                                                </td>
                                                <td className="action-cell">
                                                    {/* Actions Mise à Jour Statut (si 'pending') */}
                                                    {appt.status === 'pending' && (
                                                        <>
                                                            <button
                                                                className="action-button-icon button-success"
                                                                title="Confirmer RDV"
                                                                onClick={() => openStatusDialog(appt, 'confirmed')}
                                                                disabled={loading.action}
                                                            >
                                                                <CheckCircleIcon />
                                                            </button>
                                                            <button
                                                                className="action-button-icon button-danger"
                                                                title="Annuler RDV"
                                                                onClick={() => openStatusDialog(appt, 'cancelled')}
                                                                disabled={loading.action}
                                                            >
                                                                <CancelIcon />
                                                            </button>
                                                        </>
                                                    )}
                                                    {/* Actions Log Communication */}
                                                    <button
                                                        className="action-button-icon"
                                                        title="Enregistrer Envoi Email (Simulé)"
                                                        onClick={() => handleLogCommunication(appt.id, 'email')}
                                                        disabled={loading.action || !appt.patient?.email}
                                                    >
                                                        <EmailIcon />
                                                    </button>
                                                    <button
                                                        className="action-button-icon"
                                                        title="Enregistrer Envoi SMS (Simulé)"
                                                        onClick={() => handleLogCommunication(appt.id, 'sms')}
                                                        disabled={loading.action || !appt.patient?.telephone}
                                                    >
                                                        <SmsIcon />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>Aucun rendez-vous trouvé correspondant aux critères.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Personnalisée */}
                            {appointmentTotalRows > 0 && (
                                <div className="pagination-controls">
                                    <div className="form-group inline">
                                        <label htmlFor="rows-per-page">Lignes par page :</label>
                                        <select id="rows-per-page" value={appointmentRowsPerPage} onChange={handleChangeAppointmentRowsPerPage} disabled={loading.appointments}>
                                            {appointmentRowsPerPageOptions.map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="page-indicator">
                                        Page {appointmentPage + 1} sur {totalPages} ({appointmentTotalRows} total)
                                    </span>
                                    <div className="pagination-buttons">
                                        <button onClick={() => handleChangeAppointmentPage(appointmentPage - 1)} disabled={appointmentPage === 0 || loading.appointments} className="action-button button-outline button-small">Précédent</button>
                                        <button onClick={() => handleChangeAppointmentPage(appointmentPage + 1)} disabled={appointmentPage >= totalPages - 1 || loading.appointments} className="action-button button-outline button-small">Suivant</button>
                                    </div>
                                </div>
                            )}
                        </section>

                    </main> {/* Fin Zone Contenu */}
                </div> {/* Fin Wrapper Contenu Principal */}
            </div> {/* Fin Dashboard Body */}

            {/* Modale Confirmation Mise à Jour Statut */}
            <ConfirmationModal
                isOpen={isStatusDialogOpen}
                onClose={closeStatusDialog}
                onConfirm={handleStatusUpdate}
                title="Confirmer Changement de Statut"
                message={`Êtes-vous sûr de vouloir marquer le RDV pour ${currentAppointmentForStatus?.name || 'ce patient'} (${formatDate(currentAppointmentForStatus?.date)}) comme ${translateStatus(currentAppointmentForStatus?.targetStatus)} ? Statut actuel : ${translateStatus(currentAppointmentForStatus?.currentStatus)}.`}
                confirmText={`Oui, ${translateStatus(currentAppointmentForStatus?.targetStatus)}`}
                cancelText="Annuler"
                isLoading={loading.action}
                confirmButtonClass={currentAppointmentForStatus?.targetStatus === 'confirmed' ? 'button-success' : 'button-danger'} // Style bouton confirmation
            >
                {/* Optionnel: Ajouter un champ commentaire ici si nécessaire */}
                {/* <div className="form-group" style={{marginTop: '15px'}}>
                    <label htmlFor="confirmateur_comment">Commentaire (Optionnel)</label>
                    <textarea id="confirmateur_comment" rows="2"></textarea>
                </div> */}
            </ConfirmationModal>
        </>
    );
}

export default ConfirmateurDashboard;
