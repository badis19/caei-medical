import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from 'react';
import axios from '../axios'; // Votre instance axios configurée
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext.jsx';

// --- Composants UI (Remplacer Material UI) ---
// Garder Recharts pour les graphiques
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
// Garder react-toastify pour les notifications
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Icônes (Garder Material UI ou remplacer par SVG/autre) ---
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import BarChartIcon from '@mui/icons-material/BarChart'; // Pour Statistiques
import EventIcon from '@mui/icons-material/Event';       // Pour Rendez-vous

// --- Importer le CSS partagé ---
import './dashboard.css'; // Assurez-vous que ce fichier contient les styles nécessaires

// --- API Client (Réutilisé) ---
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json' } // Content-Type peut être défini par requête
});
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
}, error => Promise.reject(error));
// --- Fin API Client ---

// --- Composant Modal Personnalisé (Similaire à PatientDashboard si nécessaire) ---
// Créons une modal simple pour le formulaire de création
const FormModal = ({ isOpen, onClose, onSubmit, title, children, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false }) => {
    if (!isOpen) return null;
    return (
        <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}> {/* Classe 'large' pour plus d'espace */}
                {title && <h3 className="modal-title">{title}</h3>}
                <div className="modal-body">
                    {children} {/* Le contenu du formulaire sera ici */}
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


function AgentDashboard() {
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext); // Utiliser le contexte pour la déconnexion
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [clinics, setClinics] = useState([]);
    const [appointmentPage, setAppointmentPage] = useState(0);
    const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10);
    const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
    const appointmentRowsPerPageOptions = useMemo(() => [5, 10, 25], []); // Garder les options
    const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));
    const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
    const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('');
    const [loading, setLoading] = useState({ appointments: false, stats: false, clinics: false, auth: true, action: false, patients: false }); // Ajouter 'action' et 'patients'
    const [error, setError] = useState({ appointments: null, stats: null, clinics: null, general: null, dialog: null, patients: null }); // Ajouter 'dialog' et 'patients'
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newAppointment, setNewAppointment] = useState({
        patient_id: '', service: '', date_du_rdv: '', commentaire_agent: '', qualification: '',
        commentaire_1: '', commentaire_2: '', whatsapp: false, type_de_soins: '', intervention: '',
        prise_en_charge: '', budget: '', date_intervention: '', objectif: '', clinique_id: ''
    });
    const [patients, setPatients] = useState([]);

    // États pour la barre latérale et la navigation de section
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('statistics'); // Section par défaut : statistiques

    // --- Fonctions Existantes (Logique inchangée, traduction des messages) ---
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login'); return;
            }
            try {
                const response = await apiClient.get('/user');
                const agentRole = response.data?.roles?.some(role => role.name === 'agent') || response.data?.role === 'agent';
                if (agentRole) {
                    setUserRole('agent');
                    setUserName(response.data?.name || 'Agent');
                    // Charger toutes les données initiales une fois l'authentification réussie
                    fetchAllData();
                } else {
                    const userRoleDetected = response.data?.roles?.[0]?.name || response.data?.role;
                    setError(prev => ({ ...prev, general: 'Accès Refusé : Rôle agent requis.' }));
                    // Rediriger en fonction du rôle détecté si nécessaire
                    navigate(userRoleDetected === 'administrateur' ? '/dashboard' : userRoleDetected === 'superviseur' ? '/supervisor-dashboard' : '/login');
                }
            } catch (err) {
                console.error("Échec de la vérification d'authentification:", err);
                if (err.response?.status === 401) { setError(prev => ({ ...prev, general: 'Session expirée. Veuillez vous reconnecter.' })); }
                else { setError(prev => ({ ...prev, general: 'Échec de l\'authentification. Veuillez vous reconnecter.' })); }
                handleLogout(); // Déconnecter en cas d'erreur
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Dépendance : navigate

    const fetchAppointments = useCallback(async (page = 0, limit = 10, status = '') => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const apiPage = page + 1; // L'API utilise une pagination basée sur 1
            let url = `/agent/appointments?page=${apiPage}&limit=${limit}`;
            if (status) url += `&status=${status}`;
            const response = await apiClient.get(url);

            // Vérifier si les données sont bien dans response.data.data
            const appointmentsData = response.data?.data || [];
            const totalRows = response.data?.total || 0;
            const currentPageApi = response.data?.current_page || 1; // Page de l'API
            const perPageApi = response.data?.per_page || limit;

            // Déterminer la valeur correcte pour rowsPerPage
            let newRowsPerPageAppt = appointmentRowsPerPageOptions.includes(Number(perPageApi))
                ? Number(perPageApi)
                : appointmentRowsPerPageOptions.includes(Number(limit)) ? Number(limit) : appointmentRowsPerPageOptions[0];

            setAppointments(appointmentsData);
            setAppointmentTotalRows(totalRows);
            setAppointmentPage(currentPageApi - 1); // Mettre à jour la page locale (basée sur 0)
            setAppointmentRowsPerPage(newRowsPerPageAppt); // Mettre à jour le nombre de lignes par page

        } catch (err) {
            console.error("Échec de la récupération des rendez-vous agent:", err);
            setError(prev => ({ ...prev, appointments: 'Échec du chargement des rendez-vous.' }));
            toast.error('Impossible de charger les rendez-vous.');
            setAppointments([]); setAppointmentTotalRows(0);
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, [appointmentRowsPerPageOptions]); // Dépendance : options par page

    const fetchStatistics = useCallback(async (month, year) => {
        setLoading(prev => ({ ...prev, stats: true }));
        setError(prev => ({ ...prev, stats: null }));
        try {
            const response = await apiClient.get(`/agent/statistics?month=${month}&year=${year}`);
            console.log('📦 Réponse complète des statistiques:', response.data);
            setStatistics(response.data || null);
        } catch (err) {
            console.error("Échec de la récupération des statistiques agent:", err);
            setError(prev => ({ ...prev, stats: 'Échec du chargement des statistiques.' }));
            toast.error("Impossible de charger les statistiques.");
            setStatistics(null);
        } finally {
            setLoading(prev => ({ ...prev, stats: false }));
        }
    }, []);

    const fetchPatients = useCallback(async () => {
        setLoading(prev => ({ ...prev, patients: true }));
        setError(prev => ({ ...prev, patients: null }));
        try {
            const response = await apiClient.get('/agent/patients'); // Endpoint pour lister les patients accessibles à l'agent
            setPatients(response.data || []);
        } catch (err) {
            console.error("Échec de la récupération des patients:", err);
            setError(prev => ({ ...prev, patients: 'Échec du chargement de la liste des patients.' }));
            toast.error("Impossible de charger la liste des patients.");
            setPatients([]);
        } finally {
            setLoading(prev => ({ ...prev, patients: false }));
        }
    }, []);

    const fetchClinics = useCallback(async () => {
        setLoading(prev => ({ ...prev, clinics: true }));
        setError(prev => ({ ...prev, clinics: null }));
        try {
            // Assurez-vous que cet endpoint existe et retourne les cliniques associées ou toutes les cliniques
            const response = await apiClient.get(`/agent/clinics`);
            setClinics(response.data || []);
        } catch (err) {
            console.error("Échec de la récupération des cliniques:", err);
            setError(prev => ({ ...prev, clinics: 'Échec du chargement de la liste des cliniques.' }));
            toast.error("Impossible de charger la liste des cliniques."); setClinics([]);
        } finally { setLoading(prev => ({ ...prev, clinics: false })); }
    }, []);

    // Charger les statistiques lorsque le mois/année change
    useEffect(() => {
        if (userRole === 'agent') {
            fetchStatistics(statsMonth, statsYear);
        }
    }, [statsMonth, statsYear, userRole, fetchStatistics]);

    // Charger les rendez-vous lorsque le filtre de statut ou la pagination change
    useEffect(() => {
        if (userRole === 'agent') {
            // Appeler fetchAppointments avec la page actuelle (basée sur 0) et le nombre de lignes
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        }
        // N'inclure que les dépendances qui déclenchent réellement un rechargement
    }, [appointmentStatusFilter, appointmentPage, appointmentRowsPerPage, userRole, fetchAppointments]);


    // Fonction pour charger toutes les données nécessaires (appelée après connexion et potentiellement pour rafraîchir)
    const fetchAllData = useCallback(() => {
        fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        fetchStatistics(statsMonth, statsYear);
        fetchPatients(); // Charger les patients pour le formulaire
        fetchClinics();  // Charger les cliniques pour le formulaire
    }, [appointmentPage, appointmentRowsPerPage, appointmentStatusFilter, statsMonth, statsYear, fetchAppointments, fetchStatistics, fetchPatients, fetchClinics]); // Inclure toutes les fonctions fetch

    const handleCreateAppointment = async () => {
        setError(prev => ({ ...prev, dialog: null })); // Effacer les erreurs de dialogue précédentes
        setLoading(prev => ({ ...prev, action: true })); // Activer le spinner du bouton

        // Validation simple côté client
        if (!newAppointment.patient_id || !newAppointment.service || !newAppointment.date_du_rdv || !newAppointment.clinique_id) {
            toast.warn("Veuillez sélectionner un patient, une clinique, un service et une date de rendez-vous.");
            setError(prev => ({ ...prev, dialog: "Champs patient, clinique, service et date requis." }));
            setLoading(prev => ({ ...prev, action: false }));
            return;
        }

        try {
            // Préparer le payload, convertir les types si nécessaire
            const payload = {
                ...newAppointment,
                budget: newAppointment.budget ? Number(newAppointment.budget) : null, // Assurer que budget est un nombre ou null
                clinique_id: Number(newAppointment.clinique_id), // Assurer que clinique_id est un nombre
                patient_id: Number(newAppointment.patient_id),   // Assurer que patient_id est un nombre
                whatsapp: Boolean(newAppointment.whatsapp),       // Assurer que whatsapp est un booléen
                // Assurer que les dates sont dans un format attendu par l'API (ex: YYYY-MM-DD) si nécessaire
                date_du_rdv: newAppointment.date_du_rdv,
                date_intervention: newAppointment.date_intervention || null,
            };

            // Envoyer la requête POST
            const response = await apiClient.post(`/agent/appointments`, payload);

            closeCreateDialog(); // Fermer la modale
            toast.success(`Rendez-vous pour ${response.data.nom_du_prospect || 'le patient'} créé avec succès !`); // Utiliser nom_du_prospect si disponible

            // Recharger la liste des rendez-vous pour afficher le nouveau
            fetchAppointments(0, appointmentRowsPerPage, appointmentStatusFilter); // Revenir à la première page après création
            setAppointmentPage(0); // Réinitialiser la page locale

        } catch (err) {
            console.error(`Échec de la création du rendez-vous:`, err.response?.data || err.message);
            const errors = err.response?.data?.errors;
            let errorMsg = `Échec de la création du rendez-vous.`;
            if (errors) {
                // Concaténer les messages d'erreur de validation
                errorMsg += " " + Object.values(errors).flat().join(' ');
            } else if (err.response?.data?.message) {
                // Utiliser le message d'erreur général de l'API
                errorMsg += " " + err.response.data.message;
            } else {
                // Message générique
                errorMsg += " Vérifiez les détails ou le patient/prospect existe peut-être déjà.";
            }
            setError(prev => ({ ...prev, dialog: errorMsg })); // Afficher l'erreur dans la modale
            toast.error(errorMsg);
        } finally {
            setLoading(prev => ({ ...prev, action: false })); // Désactiver le spinner du bouton
        }
    };

    // Utiliser la fonction logout du contexte d'authentification
    const handleLogout = () => {
        logout(); // Gère la suppression du token, la mise à jour du contexte et la redirection
        // navigate('/login'); // Plus nécessaire si logout le fait déjà
    };

    // Ouvrir la modale de création
    const openCreateDialog = () => {
        setError(prev => ({ ...prev, dialog: null, general: null })); // Effacer les erreurs
        // Réinitialiser le formulaire
        setNewAppointment({
            patient_id: '', service: '', date_du_rdv: '', commentaire_agent: '', qualification: '',
            commentaire_1: '', commentaire_2: '', whatsapp: false, type_de_soins: '', intervention: '',
            prise_en_charge: '', budget: '', date_intervention: '', objectif: '', clinique_id: ''
        });
        // Recharger les patients et cliniques au cas où ils auraient changé
        if (patients.length === 0) fetchPatients();
        if (clinics.length === 0) fetchClinics();
        setIsCreateDialogOpen(true);
    };
    // Fermer la modale de création
    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        // Réinitialiser l'état d'action après la fermeture (avec délai pour animation)
        setTimeout(() => {
            setLoading(prev => ({ ...prev, action: false }));
            setError(prev => ({ ...prev, dialog: null }));
        }, 300);
    };

    // Gérer le changement de page pour la pagination des rendez-vous
    const handleChangeAppointmentPage = (newPage) => {
        setAppointmentPage(newPage);
        // fetchAppointments(newPage, appointmentRowsPerPage, appointmentStatusFilter); // Déclenché par useEffect
    };

    // Gérer le changement du nombre de lignes par page
    const handleChangeAppointmentRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        setAppointmentRowsPerPage(newLimit);
        setAppointmentPage(0); // Revenir à la première page lors du changement de limite
        // fetchAppointments(0, newLimit, appointmentStatusFilter); // Déclenché par useEffect
    };

    // Définir la section active et fermer la barre latérale sur mobile
    const setSection = (section) => {
        setActiveSection(section);
        if (window.innerWidth < 992) { // Point de rupture pour mobile/tablette
            setSidebarOpen(false);
        }
    };

    // --- Fonctions Utilitaires (Traduction, Formatage) ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('fr-FR', { // Locale française
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) { return 'Date Invalide'; }
    };

    // Mapper le statut à une classe CSS pour les badges
    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'pending';
            case 'confirmed': return 'confirmed';
            case 'completed': return 'completed'; // Si applicable
            case 'cancelled': return 'cancelled';
            case 'refused': return 'refused';   // Si applicable
            default: return 'default';
        }
    };

    // Traduire le statut pour l'affichage
    const translateStatus = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'En attente';
            case 'confirmed': return 'Confirmé';
            case 'completed': return 'Terminé';
            case 'cancelled': return 'Annulé';
            case 'refused': return 'Refusé';
            default: return status || 'N/A';
        }
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

    // État d'Erreur d'Authentification / Accès Refusé
    if (!userRole && !loading.auth) {
        return (
            <div className="error-container dashboard-body">
                <p>{error.general || 'Accès Refusé.'}</p>
                <button onClick={() => navigate('/login')} className="action-button">Aller à la Connexion</button>
            </div>
        );
    }

    // Statuts possibles pour le filtre de rendez-vous
    const appointmentStatuses = ['pending', 'confirmed', 'cancelled']; // Ajouter d'autres si nécessaire

    // Options pour les selects Mois/Année
    const monthsOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(0, i).toLocaleString('fr-FR', { month: 'long' }) }));
    const yearsOptions = Array.from({ length: 5 }, (_, i) => ({ value: String(new Date().getFullYear() - i), label: String(new Date().getFullYear() - i) }));

    // Calcul pour la pagination
    const totalPages = Math.ceil(appointmentTotalRows / appointmentRowsPerPage);


    return (
        <> {/* Fragment React */}
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            <div className="dashboard-body">
                {/* En-tête */}
                <header className="dashboard-header">
                    <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu">
                        <MenuIcon />
                    </button>
                    <div className="header-title">Tableau de Bord Agent ({userName})</div>
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
                        <button className={`sidebar-button ${activeSection === 'statistics' ? 'active' : ''}`} onClick={() => setSection('statistics')}>
                            <BarChartIcon /> Statistiques
                        </button>
                        <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setSection('appointments')}>
                            <EventIcon /> Rendez-vous
                        </button>
                        {/* Ajouter d'autres liens de navigation si nécessaire */}
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

                        {/* Section Statistiques */}
                        {activeSection === 'statistics' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><BarChartIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Vos Statistiques</h3>
                                    {/* Filtres Mois/Année */}
                                    <div className="filters-container">
                                        <div className="form-group inline">
                                            <label htmlFor="stats-month">Mois :</label>
                                            <select id="stats-month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)}>
                                                {monthsOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group inline">
                                            <label htmlFor="stats-year">Année :</label>
                                            <select id="stats-year" value={statsYear} onChange={(e) => setStatsYear(e.target.value)}>
                                                {yearsOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {loading.stats ? (
                                    <div className="loading-indicator">
                                        <div className="simple-spinner small"></div> Chargement des statistiques...
                                    </div>
                                ) : error.stats ? (
                                    <div className="alert-message alert-message-warning"><span>{error.stats}</span></div>
                                ) : statistics ? (
                                    <>
                                        {/* Afficher les KPIs si disponibles */}
                                        {/* <div className="kpi-grid">
                                            <div className="kpi-card">Total: {statistics.total_appointments ?? 'N/A'}</div>
                                             Ajouter d'autres KPIs
                                        </div> */}

                                        {/* Graphique d'évolution */}
                                        <div className="chart-container" style={{ height: '350px', marginTop: '20px' }}>
                                            {statistics.evolution && statistics.evolution.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={statistics.evolution}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="date" />
                                                        <YAxis allowDecimals={false} />
                                                        <RechartsTooltip />
                                                        <Legend />
                                                        <Line type="monotone" dataKey="confirmed" name="Confirmés" stroke="#4caf50" strokeWidth={2} activeDot={{ r: 6 }} />
                                                        <Line type="monotone" dataKey="cancelled" name="Annulés" stroke="#f44336" strokeWidth={2} activeDot={{ r: 6 }} />
                                                        <Line type="monotone" dataKey="pending" name="En attente" stroke="#ff9800" strokeWidth={2} activeDot={{ r: 6 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                 <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>Aucune donnée d'évolution disponible pour cette période.</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>Aucune statistique à afficher pour la période sélectionnée.</p>
                                )}
                            </section>
                        )}

                        {/* Section Rendez-vous */}
                        {activeSection === 'appointments' && (
                            <section className="content-section">
                                <div className="section-header">
                                    <h3><EventIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Mes Rendez-vous</h3>
                                    <div className="header-actions-inline">
                                        {/* Filtre Statut */}
                                        <div className="form-group inline">
                                            <label htmlFor="appt-status-filter">Filtrer Statut :</label>
                                            <select
                                                id="appt-status-filter"
                                                value={appointmentStatusFilter}
                                                onChange={(e) => {
                                                    setAppointmentStatusFilter(e.target.value);
                                                    setAppointmentPage(0); // Reset page on filter change
                                                }}
                                            >
                                                <option value="">Tous les Statuts</option>
                                                {appointmentStatuses.map(status => (
                                                    <option key={status} value={status}>{translateStatus(status)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Bouton Nouveau RDV */}
                                        <button onClick={openCreateDialog} className="action-button">
                                            <AddIcon fontSize="small" style={{ marginRight: '5px' }} /> Nouveau Rendez-vous
                                        </button>
                                    </div>
                                </div>

                                {error.appointments && <div className="alert-message alert-message-warning"><span>{error.appointments}</span></div>}

                                <div className="table-container responsive">
                                    <table className="styled-table">
                                        <thead>
                                            <tr>
                                                <th>Prospect</th>
                                                <th>Contact</th>
                                                <th>Service</th>
                                                <th>Date</th>
                                                <th>Clinique</th>
                                                <th>Statut</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
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
                                                    <td>{appt.prenom_du_prospect} {appt.nom_du_prospect}</td>
                                                    <td>{appt.telephone}<br />{appt.email}</td>
                                                    <td>{appt.service || 'N/A'}</td>
                                                    <td>{formatDate(appt.date_du_rdv)}</td>
                                                    <td>{appt.clinique?.name || 'N/A'}</td>
                                                    <td><span className={`status-badge ${getStatusClass(appt.status)}`}>{translateStatus(appt.status)}</span></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {/* Actions (désactivées pour l'instant comme dans l'original) */}
                                                        <button className="action-button-icon" title="Modification non autorisée" disabled>
                                                            <EditIcon fontSize="small" />
                                                        </button>
                                                        <button className="action-button-icon button-danger" title="Suppression non autorisée" disabled>
                                                            <DeleteIcon fontSize="small" />
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
                                        {/* Select pour lignes par page */}
                                        <div className="form-group inline">
                                            <label htmlFor="rows-per-page">Lignes par page :</label>
                                            <select id="rows-per-page" value={appointmentRowsPerPage} onChange={handleChangeAppointmentRowsPerPage}>
                                                {appointmentRowsPerPageOptions.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Indicateur de page */}
                                        <span className="page-indicator">
                                            Page {appointmentPage + 1} sur {totalPages} ({appointmentTotalRows} total)
                                        </span>

                                        {/* Boutons Précédent/Suivant */}
                                        <div className="pagination-buttons">
                                            <button
                                                onClick={() => handleChangeAppointmentPage(appointmentPage - 1)}
                                                disabled={appointmentPage === 0 || loading.appointments}
                                                className="action-button button-outline button-small"
                                            >
                                                Précédent
                                            </button>
                                            <button
                                                onClick={() => handleChangeAppointmentPage(appointmentPage + 1)}
                                                disabled={appointmentPage >= totalPages - 1 || loading.appointments}
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

            {/* Modale Création Rendez-vous */}
            <FormModal
                isOpen={isCreateDialogOpen}
                onClose={closeCreateDialog}
                onSubmit={handleCreateAppointment}
                title="Créer un Nouveau Rendez-vous"
                confirmText="Créer Rendez-vous"
                cancelText="Annuler"
                isLoading={loading.action}
            >
                {/* Afficher l'erreur de dialogue ici */}
                {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '15px' }}><span>{error.dialog}</span></div>}

                {/* Formulaire de création */}
                <div className="form-grid">
                    {/* Patient (Select) */}
                    <div className="form-group required">
                        <label htmlFor="patient_id">Patient</label>
                        {loading.patients ? <div className="simple-spinner small"></div> :
                            <select id="patient_id" name="patient_id" value={newAppointment.patient_id} onChange={(e) => setNewAppointment({ ...newAppointment, patient_id: e.target.value })} required>
                                <option value="">-- Sélectionner un Patient --</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.email})</option>
                                ))}
                            </select>}
                        {error.patients && <small className="error-text">{error.patients}</small>}
                    </div>

                    {/* Clinique (Select) */}
                    <div className="form-group required">
                        <label htmlFor="clinique_id">Clinique</label>
                        {loading.clinics ? <div className="simple-spinner small"></div> :
                            <select id="clinique_id" name="clinique_id" value={newAppointment.clinique_id} onChange={(e) => setNewAppointment({ ...newAppointment, clinique_id: e.target.value })} required>
                                <option value="">-- Sélectionner une Clinique --</option>
                                {clinics.map(clinic => (
                                    <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                                ))}
                            </select>}
                        {error.clinics && <small className="error-text">{error.clinics}</small>}
                    </div>

                    {/* Service (Input) */}
                    <div className="form-group required">
                        <label htmlFor="service">Service</label>
                        <input type="text" id="service" name="service" value={newAppointment.service} onChange={(e) => setNewAppointment({ ...newAppointment, service: e.target.value })} required />
                    </div>

                    {/* Date du RDV (Input Date) */}
                    <div className="form-group required">
                        <label htmlFor="date_du_rdv">Date du Rendez-vous</label>
                        <input type="datetime-local" id="date_du_rdv" name="date_du_rdv" value={newAppointment.date_du_rdv} onChange={(e) => setNewAppointment({ ...newAppointment, date_du_rdv: e.target.value })} required />
                    </div>

                    {/* Champs Optionnels */}
                    <div className="form-group"> <label htmlFor="commentaire_agent">Commentaire Agent</label> <input type="text" id="commentaire_agent" name="commentaire_agent" value={newAppointment.commentaire_agent} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_agent: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="qualification">Qualification</label> <input type="text" id="qualification" name="qualification" value={newAppointment.qualification} onChange={(e) => setNewAppointment({ ...newAppointment, qualification: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="commentaire_1">Commentaire 1</label> <input type="text" id="commentaire_1" name="commentaire_1" value={newAppointment.commentaire_1} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_1: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="commentaire_2">Commentaire 2</label> <input type="text" id="commentaire_2" name="commentaire_2" value={newAppointment.commentaire_2} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_2: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="type_de_soins">Type de Soins</label> <input type="text" id="type_de_soins" name="type_de_soins" value={newAppointment.type_de_soins} onChange={(e) => setNewAppointment({ ...newAppointment, type_de_soins: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="intervention">Intervention</label> <input type="text" id="intervention" name="intervention" value={newAppointment.intervention} onChange={(e) => setNewAppointment({ ...newAppointment, intervention: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="prise_en_charge">Prise en Charge</label> <input type="text" id="prise_en_charge" name="prise_en_charge" value={newAppointment.prise_en_charge} onChange={(e) => setNewAppointment({ ...newAppointment, prise_en_charge: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="budget">Budget</label> <input type="number" id="budget" name="budget" value={newAppointment.budget} onChange={(e) => setNewAppointment({ ...newAppointment, budget: e.target.value })} /> </div>
                    <div className="form-group"> <label htmlFor="date_intervention">Date Intervention</label> <input type="date" id="date_intervention" name="date_intervention" value={newAppointment.date_intervention} onChange={(e) => setNewAppointment({ ...newAppointment, date_intervention: e.target.value })} /> </div>

                    {/* Objectif (Textarea) - Pleine largeur */}
                    <div className="form-group full-width">
                        <label htmlFor="objectif">Objectif</label>
                        <textarea id="objectif" name="objectif" rows="3" value={newAppointment.objectif} onChange={(e) => setNewAppointment({ ...newAppointment, objectif: e.target.value })}></textarea>
                    </div>

                    {/* WhatsApp (Checkbox) */}
                    <div className="form-group checkbox-group full-width">
                        <input type="checkbox" id="whatsapp" name="whatsapp" checked={newAppointment.whatsapp} onChange={(e) => setNewAppointment({ ...newAppointment, whatsapp: e.target.checked })} />
                        <label htmlFor="whatsapp">Contacter via WhatsApp ?</label>
                    </div>
                </div>
            </FormModal>
        </>
    );
}

export default AgentDashboard;
