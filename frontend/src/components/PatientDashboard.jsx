import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import axios from '../axios'; // Votre instance axios configurée
import { useNavigate, Link as RouterLink } from 'react-router-dom'; // Garder RouterLink si utilisé, sinon supprimer
import { AuthContext } from '../AuthContext.jsx';

// --- Garder les icônes nécessaires (si non remplacées par des SVG) ---
import EditIcon from '@mui/icons-material/Edit'; // Exemple : Garder si utilisé
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LogoutIcon from '@mui/icons-material/Logout';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EventIcon from '@mui/icons-material/Event';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuIcon from '@mui/icons-material/Menu'; // Garder pour le toggle

// --- Notifications Toast (Garder) ---
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './dashboard.css'; // Assurez-vous que ce fichier CSS existe et est correctement stylisé


// --- Configuration du client Axios (Garder tel quel) ---
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json' } // Content-Type peut être défini par requête (ex: pour les uploads de fichiers)
});
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
}, error => Promise.reject(error));

// --- Composant Modal de Confirmation Réutilisable ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false, children }) => {
    if (!isOpen) return null;
    return (
        <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {title && <h3 className="modal-title">{title}</h3>}
                <p className="modal-message">{message}</p>
                {children && <div className="modal-body">{children}</div>}
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button cancel-button" disabled={isLoading}>{cancelText}</button>
                    <button onClick={onConfirm} className="modal-button confirm-button" disabled={isLoading}>
                        {isLoading ? (<div className="button-spinner"></div>) : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


function PatientDashboard() {
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext); // Utiliser le contexte pour la déconnexion
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('profile'); // Section par défaut

    // États des données
    const [profileData, setProfileData] = useState(null);
    const [quoteData, setQuoteData] = useState([]);
    const [quoteContext, setQuoteContext] = useState([]); // Rendez-vous lié au devis
    const [appointments, setAppointments] = useState([]);

    // États UI / Formulaires
    const [loading, setLoading] = useState({ profile: false, quote: false, appointments: false, auth: true, action: false, fileUpload: false });
    const [error, setError] = useState({ profile: null, quote: null, appointments: null, general: null, fileUpload: null, dialog: null }); // Erreur de dialogue ajoutée
    const [isEditingProfile, setIsEditingProfile] = useState(false); // Garder cet état
    const [editableProfileData, setEditableProfileData] = useState({}); // Garder cet état
    const [isQuoteActionDialogOpen, setIsQuoteActionDialogOpen] = useState(false); // État pour la modale personnalisée
    const [quoteAction, setQuoteAction] = useState({ quoteId: null, targetStatus: '' });
    const [refusalComment, setRefusalComment] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null); // Ref pour l'input de fichier


    // --- Écouteur Pusher/Echo ---
    // Déclaration de fetchQuote déplacée plus tôt pour éviter l'avertissement ESLint dans useEffect
    const fetchQuote = useCallback(async () => {
        setLoading(prev => ({ ...prev, quote: true }));
        setError(prev => ({ ...prev, quote: null }));
        try {
            const response = await apiClient.get('/patient/quotes');
            console.log('✅ Devis récupérés:', response.data);

            setQuoteData(response.data || []);


            // setQuoteContext(response.data.appointment); // Stocker les données du rendez-vous lié (Vérifier la structure de la réponse)
            // Note : La structure `response.data.appointment` semble incorrecte si `response.data` est un tableau.
            // Si chaque élément du tableau a une propriété `appointment`, il faudra l'extraire dans la boucle .map plus tard.
        } catch (err) {
            if (err.response?.status === 404) {
                // C'est normal si aucun devis n'est trouvé initialement
                setQuoteData([]); // Initialiser comme tableau vide
                setQuoteContext(null); // Ou [] selon ce qui est attendu
            } else {
                setError(prev => ({ ...prev, quote: 'Échec du chargement des informations du devis.' }));
                toast.error("Impossible de charger les détails du devis.");
            }
        } finally { setLoading(prev => ({ ...prev, quote: false })); }
    }, []); // Tableau de dépendances vide si cela ne dépend pas d'état/props externes

    useEffect(() => {
        // S'assurer que Echo est initialisé, que l'utilisateur est patient et que l'ID de profil est disponible
        if (!window.Echo || userRole !== 'patient' || !profileData?.id) {
            console.log('⏳ En attente de Echo, du rôle, ou de l\'ID profileData pour Pusher');
            return;
        }

        const channelName = `role.patient.${profileData.id}`;
        console.log(`📡 Abonnement au canal Pusher : ${channelName}`);

        const patientChannel = window.Echo.private(channelName);

        patientChannel
            .subscribed(() => {
                console.log(`✅ Abonné avec succès à ${channelName}`);
            })
            .error(error => {
                console.error(`❌ Erreur d'abonnement au canal Pusher ${channelName}:`, error);
            })
            patientChannel
        .subscribed(() => {
            console.log(`✅ Abonné avec succès à ${channelName}`);
        })
        .error(error => {
            console.error(`❌ Erreur d'abonnement au canal Pusher ${channelName}:`, error);
        })
        .listen('.quote.sent.to.patient', (event) => {
            console.log('📩 [Patient] Événement Pusher reçu : quote.sent.to.patient', event);
            toast.info('📄 Un nouveau devis vous a été envoyé !');
            fetchQuote();
        })
        .listen('.appointment.created', (event) => {
            console.log('📅 [Patient] Événement Pusher reçu : appointment.created', event);
            toast.info('📅 Un nouveau rendez-vous a été créé pour vous !');
            fetchAppointments();
        })
        .listen('.appointment.status.updated', (event) => {
            console.log('🔄 [Patient] Statut du rendez-vous mis à jour :', event);
            toast.info(`📌 Statut du rendez-vous mis à jour : ${event.status}`);
            fetchAppointments();
        });


            


        // Fonction de nettoyage pour quitter le canal lorsque le composant est démonté ou que les dépendances changent
        return () => {
            console.log(`👋 Quitte le canal Pusher ${channelName}`);
            window.Echo.leave(channelName);
        };
    }, [userRole, profileData?.id, fetchQuote]); // Dépendances : rôle, ID de profil, et la fonction fetch elle-même


    // Autorisation et récupération initiale des données
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login'); // Rediriger si pas de token
                return;
            }
            try {
                // Vérifier le token et obtenir les infos utilisateur
                const response = await apiClient.get('/user');
                const isPatient = response.data?.roles?.some(role => role.name === 'patient') || response.data?.role === 'patient'; // Vérifier le rôle

                if (isPatient) {
                    setUserRole('patient');
                    setUserName(response.data?.name || 'Patient');
                    // Récupérer les données initiales
                    await fetchProfile(); // Récupérer le profil d'abord pour obtenir l'ID pour Pusher
                    await fetchQuote();
                    await fetchAppointments();
                } else {
                    setError(prev => ({ ...prev, general: 'Accès Refusé : Rôle patient requis.' }));
                    toast.error('Accès Refusé : Rôle patient requis.');
                    handleLogout(); // Déconnecter si ce n'est pas un patient
                }
            } catch (err) {
                console.error("Échec de la vérification d'authentification (Patient):", err);
                const message = err.response?.status === 401
                    ? 'Session expirée. Veuillez vous reconnecter.'
                    : 'Échec de l\'authentification. Veuillez vous reconnecter.';
                setError(prev => ({ ...prev, general: message }));
                toast.error(message);
                handleLogout(); // Déconnecter en cas d'erreur d'authentification
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Exécuter seulement au montage / changement de navigate

    // Fonctions de récupération de données
    const fetchProfile = useCallback(async () => {
        setLoading(prev => ({ ...prev, profile: true }));
        setError(prev => ({ ...prev, profile: null }));
        try {
            const response = await apiClient.get('/patient/profile');
            setProfileData(response.data);
            // Initialiser les données modifiables seulement si les données du profil sont récupérées avec succès
            setEditableProfileData({
                telephone: response.data.telephone || '',
                date_de_naissance: response.data.date_de_naissance || '',
                adresse: response.data.adresse || '',
                allergies: response.data.allergies || '',
                medical_history: response.data.medical_history || ''
            });
        } catch (err) {
            console.error("Échec de la récupération du profil:", err);
            setError(prev => ({ ...prev, profile: 'Échec du chargement des informations du profil.' }));
            toast.error("Impossible de charger le profil.");
        } finally { setLoading(prev => ({ ...prev, profile: false })); }
    }, []); // Pas de dépendances nécessaires ici


    const fetchAppointments = useCallback(async () => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const response = await apiClient.get('/patient/appointments');
            // Trier les rendez-vous par date, les plus récents en premier
            setAppointments(response.data.sort((a, b) => new Date(b.date_du_rdv) - new Date(a.date_du_rdv)));
        } catch (err) {
            console.error("Échec de la récupération des rendez-vous:", err);
            setError(prev => ({ ...prev, appointments: 'Échec du chargement des informations des rendez-vous.' }));
            toast.error("Impossible de charger les rendez-vous.");
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, []);

    // Gestionnaires d'actions
    const handleProfileUpdate = async () => {
        setLoading(prev => ({ ...prev, action: true }));
        setError(prev => ({ ...prev, general: null })); // Effacer les erreurs générales
        const payload = {
            // Inclure seulement les champs modifiables par le patient
            telephone: editableProfileData.telephone,
            date_de_naissance: editableProfileData.date_de_naissance || null, // Gérer date vide
            adresse: editableProfileData.adresse || null,
            allergies: editableProfileData.allergies || null,
            medical_history: editableProfileData.medical_history || null,
        };
        try {
            const response = await apiClient.put('/patient/profile', payload);
            setProfileData(response.data); // Mettre à jour l'état des données du profil
            setIsEditingProfile(false); // Quitter le mode édition
            toast.success("Profil mis à jour avec succès !");
        } catch (err) {
            console.error("Échec de la mise à jour du profil:", err.response?.data || err.message);
            const errorMsg = `Échec de la mise à jour du profil. ${err.response?.data?.message || 'Veuillez vérifier vos entrées.'}`;
            setError(prev => ({ ...prev, general: errorMsg })); // Afficher l'erreur spécifique à cette action
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, action: false })); }
    };

    const handleQuoteStatusUpdate = async () => {
        if (quoteAction.targetStatus === 'refused' && !refusalComment.trim()) {
            toast.error('Le commentaire de refus est obligatoire.');
            setError(prev => ({ ...prev, dialog: 'Le commentaire de refus est obligatoire.' })); // Afficher l'erreur dans la modale
            return;
        }
        setLoading(prev => ({ ...prev, action: true }));
        setError(prev => ({ ...prev, dialog: null })); // Effacer l'erreur de la modale

        const payload = {
            status: quoteAction.targetStatus,
            ...(quoteAction.targetStatus === 'refused' && { comment: refusalComment.trim() })
        };

        try {
            const response = await apiClient.patch(`/patient/quotes/${quoteAction.quoteId}/status`, payload);
            // Mettre à jour les données du devis spécifique dans le tableau quoteData
            setQuoteData(prevQuoteData =>
                prevQuoteData.map(item =>
                    item.quote.id === quoteAction.quoteId ? { ...item, quote: response.data } : item
                )
            );
            closeQuoteActionDialog(); // Fermer la modale
            toast.success(`Statut du devis mis à jour à ${quoteAction.targetStatus === 'accepted' ? 'Accepté' : 'Refusé'}.`);
        } catch (err) {
            console.error("Échec de la mise à jour du statut du devis:", err.response?.data || err.message);
            const errorMsg = `Échec de la mise à jour du statut du devis : ${err.response?.data?.message || 'Une erreur est survenue'}`;
            setError(prev => ({ ...prev, dialog: errorMsg })); // Afficher l'erreur dans la modale
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, action: false })); }
    };

    const handleLogout = () => {
        logout(); // Utiliser logout depuis AuthContext
        navigate('/login'); // Rediriger vers la page de connexion après déconnexion
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            setError(prev => ({ ...prev, fileUpload: null })); // Effacer l'erreur de fichier précédente
        } else {
            setSelectedFile(null);
            const errorMsg = 'Veuillez sélectionner un fichier PDF valide.';
            setError(prev => ({ ...prev, fileUpload: errorMsg }));
            toast.error(errorMsg);
            if (fileInputRef.current) {
                fileInputRef.current.value = null; // Réinitialiser l'input de fichier
            }
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) {
            toast.warn('Veuillez sélectionner un fichier PDF à téléverser.');
            return;
        }
        setLoading(prev => ({ ...prev, fileUpload: true }));
        setError(prev => ({ ...prev, fileUpload: null })); // Effacer les erreurs précédentes

        const formData = new FormData();
        formData.append('file', selectedFile); // 'file' doit correspondre à l'attente du backend

        try {
            // Utiliser apiClient configuré avec l'URL de base et l'intercepteur d'authentification
            await apiClient.post('/patient/medical-files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' } // Important pour les uploads de fichiers
            });
            toast.success(`Fichier "${selectedFile.name}" téléversé avec succès !`);
            setSelectedFile(null); // Effacer l'état du fichier sélectionné
            if (fileInputRef.current) {
                fileInputRef.current.value = null; // Réinitialiser l'input de fichier visuellement
            }
            // Optionnellement, recharger le profil ou les données liées si l'upload les affecte
            // fetchProfile();
        } catch (err) {
            console.error("Échec du téléversement du fichier:", err.response?.data || err.message);
            const errorMsg = `Échec du téléversement du fichier : ${err.response?.data?.message || 'Une erreur serveur est survenue'}`;
            setError(prev => ({ ...prev, fileUpload: errorMsg }));
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, fileUpload: false })); }
    };

    // Basculer le mode édition pour le profil
    const handleEditProfileToggle = () => {
        if (!isEditingProfile && profileData) {
            // Remplir l'état modifiable en entrant en mode édition
            setEditableProfileData({
                telephone: profileData.telephone || '',
                date_de_naissance: profileData.date_de_naissance || '',
                adresse: profileData.adresse || '',
                allergies: profileData.allergies || '',
                medical_history: profileData.medical_history || ''
            });
        } else {
            // Réinitialiser l'état modifiable si l'édition est annulée (optionnel)
            setEditableProfileData({});
        }
        setIsEditingProfile(!isEditingProfile);
    };

    // Mettre à jour l'état du profil modifiable lors du changement d'input
    const handleEditableProfileChange = (event) => {
        const { name, value } = event.target;
        setEditableProfileData(prev => ({ ...prev, [name]: value }));
    };

    // Ouvrir la modale de confirmation d'action sur le devis
    const openQuoteActionDialog = (quoteId, status) => {
        setQuoteAction({ quoteId, targetStatus: status });
        setRefusalComment(''); // Réinitialiser le commentaire
        setError(prev => ({ ...prev, dialog: null })); // Effacer les erreurs de dialogue précédentes
        setIsQuoteActionDialogOpen(true);
    };


    // Fermer la modale de confirmation d'action sur le devis
    const closeQuoteActionDialog = () => {
        setIsQuoteActionDialogOpen(false);
        // Réinitialiser l'état après la fermeture de la modale (ajouter un léger délai pour l'animation)
        setTimeout(() => {
            setRefusalComment('');
            setQuoteAction({ quoteId: null, targetStatus: '' });
            setError(prev => ({ ...prev, dialog: null })); // Effacer les erreurs de dialogue
            setLoading(prev => ({ ...prev, action: false })); // S'assurer que l'état de chargement est réinitialisé
        }, 300);
    };

    // --- Fonctions Utilitaires ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Utiliser un formatage plus robuste
            return new Date(dateString).toLocaleString('fr-FR', { // Locale française
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false // Ajuster le format si nécessaire
            });
        } catch (e) {
            return 'Date Invalide';
        }
    };

    // Mapper le statut à une classe CSS pour les badges
    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'pending';
            case 'confirmed': return 'confirmed';
            case 'completed': return 'completed';
            case 'accepted': return 'accepted'; // Ajouté pour les devis
            case 'cancelled': return 'cancelled';
            case 'refused': return 'refused'; // Ajouté pour les devis
            default: return 'default';
        }
    };

    // Traduire le statut pour l'affichage
    const translateStatus = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'En attente';
            case 'confirmed': return 'Confirmé';
            case 'completed': return 'Terminé';
            case 'accepted': return 'Accepté';
            case 'cancelled': return 'Annulé';
            case 'refused': return 'Refusé';
            default: return status || 'N/A'; // Retourne le statut original ou N/A si vide
        }
    };


    // Définir la section active et fermer la barre latérale sur mobile
    const setSection = (section) => {
        setActiveSection(section);
        if (window.innerWidth < 992) { // Ajuster le point de rupture si nécessaire
            setSidebarOpen(false);
        }
    };

    // --- Logique de Rendu ---

    // État de Chargement Initial
    if (loading.auth) {
        return (
            <div className="loading-container dashboard-body"> {/* Utiliser dashboard-body pour un fond cohérent */}
                <div className="simple-spinner"></div>
                <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Chargement de votre tableau de bord...</p>
            </div>
        );
    }

    // État d'Erreur d'Authentification
    if (!userRole && !loading.auth) {
        return (
            <div className="error-container dashboard-body"> {/* Utiliser dashboard-body */}
                <p>{error.general || 'Accès Refusé.'}</p>
                {/* Utiliser RouterLink si installé, sinon ancre standard */}
                <button onClick={() => navigate('/login')} className="action-button">Aller à la Connexion</button>
            </div>
        );
    }

    // Filtrer les rendez-vous en à venir et passés
    const now = new Date();
    const upcomingAppointments = appointments.filter(app => new Date(app.date_du_rdv) >= now);
    const pastAppointments = appointments.filter(app => new Date(app.date_du_rdv) < now);

    return (
        <> {/* Utiliser Fragment au lieu de Box */}
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            <div className="dashboard-body">
                {/* En-tête */}
                <header className="dashboard-header">
                    <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu">
                        <MenuIcon /> {/* Garder l'icône Material UI ou remplacer par SVG */}
                    </button>
                    <div className="header-title">Tableau de Bord Patient ({userName})</div>
                    <div className="header-actions">
                        <button onClick={handleLogout} className="action-button button-outline">
                            <LogoutIcon fontSize="small" style={{ marginRight: '5px' }} /> Déconnexion
                        </button>
                    </div>
                </header>

                {/* Wrapper Contenu Principal */}
                <div className="main-content-wrapper">
                    {/* Barre Latérale */}
                    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                        {/* Boutons de Navigation de la Barre Latérale */}
                        <button className={`sidebar-button ${activeSection === 'profile' ? 'active' : ''}`} onClick={() => setSection('profile')}>
                            <AssignmentIndIcon /> Mon Profil
                        </button>
                        <button className={`sidebar-button ${activeSection === 'quote' ? 'active' : ''}`} onClick={() => setSection('quote')}>
                            <ReceiptLongIcon /> Mes Devis
                        </button>
                        <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setSection('appointments')}>
                            <EventIcon /> Mes Rendez-vous
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

                        {/* Section Profil */}
                        {activeSection === 'profile' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><AssignmentIndIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Mon Profil & Infos Médicales</h3>
                                    <button onClick={handleEditProfileToggle} className="action-button button-small button-outline">
                                        <EditIcon fontSize="small" style={{ marginRight: '4px' }} /> {isEditingProfile ? 'Annuler la Modification' : 'Modifier le Profil'}
                                    </button>
                                </div>

                                {loading.profile ? (
                                    <div style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner"></div></div>
                                ) : error.profile ? (
                                    <div className="alert-message alert-message-warning"><span>{error.profile}</span></div>
                                ) : profileData ? (
                                    <>
                                        {/* Mode Affichage */}
                                        {!isEditingProfile && (
                                            <div className="list-group">
                                                <div className="list-item"><strong>Nom :</strong> {profileData.name} {profileData.last_name}</div>
                                                <div className="list-item"><strong>Email :</strong> {profileData.email}</div>
                                                <div className="list-item"><strong>Téléphone :</strong> {profileData.telephone || 'Non fourni'}</div>
                                                <div className="list-item"><strong>Date de Naissance :</strong> {profileData.date_de_naissance ? new Date(profileData.date_de_naissance).toLocaleDateString('fr-FR') : 'Non fournie'}</div>
                                                <div className="list-item"><strong>Adresse :</strong> <pre>{profileData.adresse || 'Non fournie'}</pre></div>
                                                <hr style={{ margin: '15px 0' }} />
                                                <h4>Infos Médicales</h4>
                                                <div className="list-item"><strong>Allergies :</strong> <pre>{profileData.allergies || 'Aucune spécifiée'}</pre></div>
                                                <div className="list-item"><strong>Antécédents Médicaux :</strong> <pre>{profileData.medical_history || 'Aucun spécifié'}</pre></div>
                                            </div>
                                        )}

                                        {/* Mode Édition */}
                                        {isEditingProfile && (
                                            <div className="form-grid">
                                                <div className="form-group">
                                                    <label htmlFor="telephone">Téléphone</label>
                                                    <input type="tel" id="telephone" name="telephone" value={editableProfileData.telephone} onChange={handleEditableProfileChange} />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="date_de_naissance">Date de Naissance</label>
                                                    <input type="date" id="date_de_naissance" name="date_de_naissance" value={editableProfileData.date_de_naissance} onChange={handleEditableProfileChange} />
                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label htmlFor="adresse">Adresse</label>
                                                    <textarea id="adresse" name="adresse" rows="3" value={editableProfileData.adresse} onChange={handleEditableProfileChange}></textarea>
                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label htmlFor="allergies">Allergies</label>
                                                    <textarea id="allergies" name="allergies" rows="3" value={editableProfileData.allergies} onChange={handleEditableProfileChange}></textarea>
                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label htmlFor="medical_history">Antécédents Médicaux</label>
                                                    <textarea id="medical_history" name="medical_history" rows="4" value={editableProfileData.medical_history} onChange={handleEditableProfileChange}></textarea>
                                                </div>
                                                <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: '10px' }}>
                                                    <button onClick={handleProfileUpdate} className="action-button confirm-button" disabled={loading.action}>
                                                        {loading.action ? <div className="button-spinner"></div> : 'Enregistrer les Modifications'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Section Téléversement Fichier (Toujours Visible) */}
                                        <hr style={{ margin: '25px 0' }} />
                                        <h4>Envoyer un Document Médical (PDF uniquement)</h4>
                                        <div className="file-upload-area">
                                            <input
                                                type="file"
                                                id="medical-file-input"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                accept=".pdf"
                                                style={{ display: 'none' }} // Cacher l'input par défaut
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="action-button button-outline"
                                                disabled={loading.fileUpload}
                                            >
                                                <DescriptionIcon fontSize="small" style={{ marginRight: '5px' }} /> Choisir PDF
                                            </button>
                                            {selectedFile && <span className="file-name">{selectedFile.name}</span>}
                                            <button
                                                type="button"
                                                onClick={handleFileUpload}
                                                className="action-button"
                                                disabled={!selectedFile || loading.fileUpload}
                                            >
                                                {loading.fileUpload ? <div className="button-spinner"></div> : <><UploadFileIcon fontSize="small" style={{ marginRight: '5px' }} /> Envoyer</>}
                                            </button>
                                        </div>
                                        {error.fileUpload && <div className="alert-message alert-message-error" style={{ marginTop: '10px' }}><span>{error.fileUpload}</span></div>}
                                    </>
                                ) : (
                                    <p>Aucune donnée de profil disponible.</p>
                                )}
                            </section>
                        )}

                        {/* Section Devis */}
                        {activeSection === 'quote' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><ReceiptLongIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Mes Devis</h3>
                                </div>

                                {loading.quote ? (
                                    <div style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner"></div></div>
                                ) : error.quote ? (
                                    <div className="alert-message alert-message-warning"><span>{error.quote}</span></div>
                                ) : quoteData?.length > 0 ? (
                                    quoteData
                                        .filter(({ quote }) => !!quote?.file_path) // ✅ filtrer les devis sans PDF
                                        .map(({ quote, appointment }) => ( // Assurez-vous que 'appointment' est bien passé ici depuis l'API

                                            <div key={quote.id} className="quote-card">
                                                <div className="list-group">
                                                    <div className="list-item"><strong>ID Devis :</strong> {quote.id}</div>
                                                    <div className="list-item"><strong>Statut :</strong> <span className={`status-badge ${getStatusClass(quote.status)}`}>{translateStatus(quote.status)}</span></div>
                                                    <div className="list-item"><strong>Nom du fichier :</strong> {quote.filename || 'N/A'}</div>
                                                    {/* Vérifier si 'appointment' existe avant d'accéder à ses propriétés */}
                                                    <div className="list-item"><strong>Date Rendez-vous :</strong> {appointment ? formatDate(appointment.date_du_rdv) : 'N/A'}</div>
                                                    <div className="list-item"><strong>Service :</strong> {appointment?.service || 'N/A'}</div>
                                                    <div className="list-item"><strong>Agent :</strong> {appointment?.agent?.name} {appointment?.agent?.last_name || 'N/A'}</div>
                                                    <div className="list-item"><strong>Clinique :</strong> {appointment?.clinique?.name || 'N/A'}</div>
                                                    <div className="list-item">
                                                        <button
                                                            className="action-button button-small button-outline"
                                                            onClick={async () => {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    // S'assurer que baseURL se termine par /api ou non, ajuster si nécessaire
                                                                    const downloadUrl = `${apiClient.defaults.baseURL}/patient/quotes/${quote.id}/download`;
                                                                    const response = await fetch(downloadUrl, {
                                                                        headers: { Authorization: `Bearer ${token}` }
                                                                    });
                                                                    if (!response.ok) {
                                                                        throw new Error(`Erreur serveur: ${response.statusText}`);
                                                                    }
                                                                    const blob = await response.blob();
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = quote.filename || `devis_${quote.id}.pdf`;
                                                                    document.body.appendChild(a); // Nécessaire pour Firefox
                                                                    a.click();
                                                                    a.remove(); // Nettoyer
                                                                    URL.revokeObjectURL(url);
                                                                } catch (err) {
                                                                    console.error("Erreur téléchargement PDF:", err);
                                                                    toast.error("Échec du téléchargement du PDF.");
                                                                }
                                                            }}
                                                        >
                                                            <DescriptionIcon fontSize="inherit" style={{ marginRight: '4px' }} /> Télécharger PDF
                                                        </button>
                                                    </div>

                                                    {quote.status === 'refused' && quote.comment && (
                                                        <div className="list-item" style={{ fontStyle: 'italic' }}>Motif du Refus : {quote.comment}</div>
                                                    )}

                                                    {/* Afficher les boutons seulement si le statut est 'pending' ou null/undefined */}
                                                    {(quote.status === 'pending' || !quote.status) && (
                                                        <div className="list-item action-row">
                                                            <button className="action-button button-success" onClick={() => openQuoteActionDialog(quote.id, 'accepted')} disabled={loading.action}>
                                                                <CheckCircleIcon fontSize="small" style={{ marginRight: '5px' }} /> Accepter
                                                            </button>
                                                            <button className="action-button button-warning" onClick={() => openQuoteActionDialog(quote.id, 'refused')} disabled={loading.action}>
                                                                <CancelIcon fontSize="small" style={{ marginRight: '5px' }} /> Refuser
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <hr />
                                            </div>
                                        ))
                                ) : (
                                    <p style={{ color: 'var(--text-light)' }}>Aucun devis disponible.</p>
                                )}
                            </section>
                        )}

                        {/* Section Rendez-vous */}
                        {activeSection === 'appointments' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><EventIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Mes Rendez-vous</h3>
                                </div>
                                {loading.appointments ? (
                                    <div style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner"></div></div>
                                ) : error.appointments ? (
                                    <div className="alert-message alert-message-warning"><span>{error.appointments}</span></div>
                                ) : appointments.length > 0 ? (
                                    <div>
                                        {upcomingAppointments.length > 0 && (
                                            <>
                                                <h4>À venir</h4>
                                                <div className="table-container responsive">
                                                    <table className="styled-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Date & Heure</th>
                                                                <th>Service</th>
                                                                <th>Clinique</th>
                                                                <th>Statut</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {upcomingAppointments.map((app) => (
                                                                <tr key={app.id}>
                                                                    <td>{formatDate(app.date_du_rdv)}</td>
                                                                    <td>{app.service || 'N/A'}</td>
                                                                    <td>{app.clinique?.name || 'N/A'}</td>
                                                                    <td><span className={`status-badge ${getStatusClass(app.status)}`}>{translateStatus(app.status)}</span></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}
                                        {pastAppointments.length > 0 && (
                                            <>
                                                <h4 style={{ marginTop: upcomingAppointments.length > 0 ? '30px' : '0' }}>Passés</h4>
                                                <div className="table-container responsive">
                                                    <table className="styled-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Date & Heure</th>
                                                                <th>Service</th>
                                                                <th>Clinique</th>
                                                                <th>Statut</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {pastAppointments.map((app) => (
                                                                <tr key={app.id}>
                                                                    <td>{formatDate(app.date_du_rdv)}</td>
                                                                    <td>{app.service || 'N/A'}</td>
                                                                    <td>{app.clinique?.name || 'N/A'}</td>
                                                                    <td><span className={`status-badge ${getStatusClass(app.status)}`}>{translateStatus(app.status)}</span></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}
                                        {upcomingAppointments.length === 0 && pastAppointments.length === 0 && (
                                            <p style={{ color: 'var(--text-light)' }}>Vous n'avez aucun rendez-vous planifié.</p>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-light)' }}>Aucun historique de rendez-vous trouvé.</p>
                                )}
                            </section>
                        )}

                    </main> {/* Fin Zone Contenu */}
                </div> {/* Fin Wrapper Contenu Principal */}
            </div> {/* Fin Dashboard Body */}

            {/* Modale Confirmation Action Devis */}
            <ConfirmationModal
                isOpen={isQuoteActionDialogOpen}
                onClose={closeQuoteActionDialog}
                onConfirm={handleQuoteStatusUpdate}
                title="Confirmer la Décision sur le Devis"
                message={`Êtes-vous sûr de vouloir ${quoteAction.targetStatus === 'accepted' ? 'accepter' : 'refuser'} ce devis ? ${quoteAction.targetStatus === 'accepted' ? ' Cette action pourrait être définitive.' : ''}`}
                confirmText={`Oui, ${quoteAction.targetStatus === 'accepted' ? 'Accepter' : 'Refuser'}`}
                cancelText="Annuler" // Texte du bouton Annuler
                isLoading={loading.action}
            >
                {/* Rendre conditionnellement le champ de commentaire dans le corps de la modale */}
                {quoteAction.targetStatus === 'refused' && (
                    <div className="form-group" style={{ marginTop: '15px' }}>
                        <label htmlFor="refusalComment">Motif du Refus (Obligatoire)</label>
                        <textarea
                            id="refusalComment"
                            rows="3"
                            value={refusalComment}
                            onChange={(e) => setRefusalComment(e.target.value)}
                            placeholder="Veuillez fournir une brève raison"
                            required
                            autoFocus
                        ></textarea>
                        {error.dialog && <p className="alert-message alert-message-error" style={{ fontSize: '0.9em', marginTop: '5px', marginBottom: '0' }}>{error.dialog}</p>}
                    </div>
                )}
            </ConfirmationModal>
        </>
    );
}

export default PatientDashboard;
