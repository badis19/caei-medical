import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Line } from 'recharts'; // Added Line
import { useDebounce } from 'react-use';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// It's recommended to install and import html2canvas and jspdf for export functionality
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';

// --- IMPORT THE CSS FILE ---
import './dashboard.css'; // Adjust path if css file is in a different directory
// Add the following CSS to your dashboard.css for mobile responsiveness and new elements:
/*

*/


// --- Axios Client Setup (Keep as is) ---
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  headers: {
    'Accept': 'application/json',
  }
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// --- Helper Hook for Auth/Logout (Keep as is) ---
const useAuth = () => {
  const navigate = useNavigate();
  const logout = useCallback(() => {
    console.log("Logging out..."); // Developer log, can stay in English
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);
  return { logout };
};

// --- Reusable Toast Notification Component (Keep as is - messages are passed to it) ---
const ToastNotification = ({ message, type }) => {
  if (!message) return null;
  // Icons can remain as they are universal or easily understood
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'info' ? 'ℹ' : '⚠';
  return (
    <div className={`toast-notification toast-${type}`}>
      <span className="toast-icon">{icon}</span>
      <span className="toast-message">{message}</span>
    </div>
  );
};

// --- Reusable Confirmation Modal Component ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmer', cancelText = 'Annuler', isLoading = false }) => {
  if (!isOpen) return null;
  return (
    <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button" disabled={isLoading}>{cancelText}</button>
          <button onClick={onConfirm} className="modal-button confirm-button" disabled={isLoading}>
            {isLoading ? (
              <div className="button-spinner"></div>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Reusable Dialog Component (Keep as is - content is passed via props/children) ---
const FormDialog = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;
  return (
    <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
      <div className="modal-content form-dialog-content" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-actions">
          {actions}
        </div>
      </div>
    </div>
  );
};


// --- Main Dashboard Component ---
function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const chartContainerRef = useRef(null); // Ref for chart container for export

  // --- State Variables ---
  const [userRole, setUserRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [userPage, setUserPage] = useState(0);
  const [userRowsPerPage, setUserRowsPerPage] = useState(10);
  const [userTotalRows, setUserTotalRows] = useState(0);
  const userRowsPerPageOptions = useMemo(() => [5, 10, 25, 50], []);
  const [appointmentPage, setAppointmentPage] = useState(0);
  const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10); // Default for display, fetch might be different
  const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
  const appointmentRowsPerPageOptions = useMemo(() => [5, 10, 25, 1000], []); // Added 1000 for fetching all
  const [quotePage, setQuotePage] = useState(0);
  const [quoteRowsPerPage, setQuoteRowsPerPage] = useState(10);
  const [quoteTotalRows, setQuoteTotalRows] = useState(0);
  const quoteRowsPerPageOptions = useMemo(() => [5, 10, 25], []);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [debouncedQuoteSearch, setDebouncedQuoteSearch] = useState('');
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState({ users: false, appointments: false, stats: false, quotes: false, auth: true });
  const [error, setError] = useState({ users: null, appointments: null, stats: null, quotes: null, general: null, dialog: null });
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '', last_name: '', email: '', password: '', role: '', telephone: '', adresse: ''
  });
  const [appointmentViewPage, setAppointmentViewPage] = useState(0);
  const [appointmentViewRowsPerPage, setAppointmentViewRowsPerPage] = useState(10);
  const appointmentViewRowsPerPageOptions = useMemo(() => [5, 10, 25], []);

  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    appointment_id: '',
    file: null,
    total_clinique: '',
    assistance_items: [{ label: '', amount: '' }],
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('statistics');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', onConfirm: () => { } });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [currentQuoteId, setCurrentQuoteId] = useState(null);

  // New state variables for statistics enhancements
  const [granularity, setGranularity] = useState('daily');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 });


  const roles = useMemo(() => ['administrateur', 'superviseur', 'agent', 'confirmateur', 'patient', 'clinique'], []);
  const chartColors = ['#c29b6e', '#88a0a8', '#e8d8c3', '#5c4b3a', '#a0aec0', '#f6e05e', '#b794f4'];

  // --- Helper Functions (Toast & Modal) ---
  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    if (!isMountedRef.current) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setIsToastVisible(false);
      setTimeout(() => setToastMessage(''), 500);
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const openConfirmationModal = useCallback(({ title, message, onConfirm, confirmText = 'Confirmer' }) => {
    if (!isMountedRef.current) return;
    setModalError('');
    setModalConfig({ title, message, onConfirm, confirmText });
    setIsModalOpen(true);
  }, []);

  const closeConfirmationModal = useCallback(() => {
    setIsModalOpen(false);
    setModalLoading(false);
    setModalError('');
    setTimeout(() => setModalConfig({ title: '', message: '', onConfirm: () => { } }), 300);
  }, []);

  const handleModalConfirm = useCallback(async () => {
    if (typeof modalConfig.onConfirm === 'function') {
      setModalLoading(true);
      setModalError('');
      try {
        await modalConfig.onConfirm();
      } catch (error) {
        console.error("Modal confirmation action failed:", error);
        const errorMessage = error.message || 'Une erreur inattendue s\'est produite lors de la confirmation.';
        setError(prev => ({ ...prev, dialog: errorMessage }));
        showToast(errorMessage, 'error');
        setModalLoading(false); // Ensure loading is reset on error
      }
      // No automatic close here, onConfirm should handle it or call closeConfirmationModal
    } else {
      closeConfirmationModal();
    }
  }, [modalConfig, closeConfirmationModal, showToast]);


  // --- Data Fetching Functions ---
  const fetchUsers = useCallback(async (page = 0, limit = 10, search = '', role = '') => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, users: true }));
    setError(prev => ({ ...prev, users: null }));
    try {
      const apiPage = page + 1;
      const queryParams = new URLSearchParams({ page: apiPage, limit: limit, search: search });
      if (role) queryParams.append('role', role);
      const response = await apiClient.get(`/admin/users?${queryParams.toString()}`);
      if (!isMountedRef.current) return;
      const responseData = response.data?.data || [];
      const total = response.data?.total || 0;
      const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0;
      let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;
      if (!userRowsPerPageOptions.includes(perPage)) {
        perPage = userRowsPerPageOptions.includes(limit) ? limit : userRowsPerPageOptions[1];
      }
      setUsers(responseData);
      setUserTotalRows(total);
      setUserPage(currentPage);
      setUserRowsPerPage(perPage);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, users: 'Échec de la récupération des utilisateurs.' }));
      showToast('Échec du chargement des utilisateurs. Veuillez essayer de rafraîchir.', 'error');
      setUsers([]); setUserTotalRows(0);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, users: false }));
    }
  }, [userRowsPerPageOptions, showToast]);

  const fetchAppointments = useCallback(async (page = 0, limit = 1000) => { // Default limit to fetch more for filtering
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, appointments: true }));
    setError(prev => ({ ...prev, appointments: null }));
    try {
      const apiPage = page + 1; // API might be 1-indexed
      const response = await apiClient.get(`/admin/appointments?page=${apiPage}&limit=${limit}`);
      if (!isMountedRef.current) return;
      const responseData = response.data?.data || [];
      // Assuming the API returns all appointments if limit is high,
      // and we handle pagination client-side for the view table
      setAppointments(responseData);
      // For a server-side paginated main appointment list, you'd set total rows etc. here.
      // For now, this just loads data for the view table.
      // setAppointmentTotalRows(response.data?.total || 0);
      // setAppointmentPage(response.data?.current_page ? response.data.current_page -1 : 0);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, appointments: 'Échec de la récupération des rendez-vous.' }));
      showToast('Échec du chargement des rendez-vous.', 'error');
      setAppointments([]);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, appointments: false }));
    }
  }, [showToast]); // Removed appointmentRowsPerPageOptions if main list isn't server paginated by this

  const fetchQuotes = useCallback(async (page = 0, limit = 10, search = '') => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, quotes: true }));
    setError(prev => ({ ...prev, quotes: null }));
    try {
      const apiPage = page + 1;
      const quotesRes = await apiClient.get(`/admin/quotes?page=${apiPage}&limit=${limit}&search=${search}`);
      if (!isMountedRef.current) return;
      const paginationData = quotesRes.data;
      const quotesData = paginationData.data || [];
      const total = paginationData.total || 0;
      const currentPage = paginationData.current_page ? paginationData.current_page - 1 : 0;
      let perPage = paginationData.per_page ? Number(paginationData.per_page) : limit;
      if (!quoteRowsPerPageOptions.includes(perPage)) {
        perPage = quoteRowsPerPageOptions.includes(limit) ? limit : quoteRowsPerPageOptions[1];
      }
      setQuotes(quotesData);
      setQuoteTotalRows(total);
      setQuotePage(currentPage);
      setQuoteRowsPerPage(perPage);
    } catch (err) {
      console.error("Failed to fetch quotes:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, quotes: 'Échec de la récupération des devis.' }));
      showToast('Échec du chargement des devis.', 'error');
      setQuotes([]); setQuoteTotalRows(0); setQuotePage(0);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, quotes: false }));
    }
  }, [quoteRowsPerPageOptions, showToast]);

  // Updated fetchStatistics Function
  const fetchStatistics = useCallback(async (month, year) => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, stats: true }));
    setError(prev => ({ ...prev, stats: null }));
    try {
      const response = await apiClient.get(`/admin/statistics`, {
        params: {
          month,
          year,
          granularity, // new param
          compare_previous: comparePrevious ? 1 : 0, // new param
        },
      });
      if (!isMountedRef.current) return;
      const data = response.data;
      if (data && Array.isArray(data.labels) && Array.isArray(data.datasets)) {
        setStatistics(data);
        // Optional backend fields for summary
        setSummaryStats({
          totalRdv: data.total_appointments || 0,
          totalQuotes: data.total_quotes || 0,
          acceptedRate: data.accepted_percentage || 0,
        });
      } else {
        console.warn("Statistics API response format unexpected.", data);
        setError(prev => ({ ...prev, stats: 'Format des données statistiques incorrect.' }));
        setStatistics(null); // Clear previous stats on format error
        setSummaryStats({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 }); // Reset summary
        showToast("Format des statistiques reçu inattendu.", 'error');
      }
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, stats: `Échec de la récupération des statistiques (${err.response?.status || 'Erreur réseau'}).` }));
      showToast("Impossible de charger les statistiques.", 'error');
      setStatistics(null); // Clear previous stats on fetch error
      setSummaryStats({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 }); // Reset summary
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [granularity, comparePrevious, showToast]); // Added dependencies


  // --- Debounce Hooks ---
  useDebounce(() => {
    setDebouncedUserSearch(userSearch);
    // fetchUsers(0, userRowsPerPage, userSearch, selectedRoleFilter); // Fetch on change
  }, 500, [userSearch]); // Removed dependencies that might cause rapid refetch

  useEffect(() => { // Separate effect for actual fetching based on debounced value
    if (userRole === 'administrateur' && !loading.auth && isMountedRef.current) {
      fetchUsers(0, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
    }
  }, [debouncedUserSearch, userRowsPerPage, selectedRoleFilter, userRole, loading.auth, fetchUsers]);


  useDebounce(() => {
    setDebouncedQuoteSearch(quoteSearch);
    // fetchQuotes(0, quoteRowsPerPage, quoteSearch); // Fetch on change
  }, 500, [quoteSearch]); // Removed dependencies

  useEffect(() => {
    if (userRole === 'administrateur' && !loading.auth && isMountedRef.current) {
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
    }
  }, [debouncedQuoteSearch, quotePage, quoteRowsPerPage, userRole, loading.auth, fetchQuotes]);



  // --- Authorization and Initial Data Fetch ---
  useEffect(() => {
    isMountedRef.current = true;
    const checkAuthAndFetch = async () => {
      if (!isMountedRef.current) return;
      setLoading(prev => ({ ...prev, auth: true }));
      setError(prev => ({ ...prev, general: null }));
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const response = await apiClient.get('/user');
        if (!isMountedRef.current) return;
        const isAdmin = response.data?.roles?.some(role => role.name === 'administrateur');
        if (isAdmin) {
          setUserRole('administrateur');
          // Initial fetches
          await Promise.all([
            fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter),
            fetchAppointments(0, 1000), // Fetch all appointments initially for client-side filtering/display
            fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch),
            fetchStatistics(statsMonth, statsYear) // Initial stats fetch
          ]);
        } else {
          setError(prev => ({ ...prev, general: 'Accès refusé : Rôle administrateur requis.' }));
          showToast('Accès refusé. Rôle administrateur requis.', 'error');
          handleLogout(); // Use the correct logout function
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!isMountedRef.current) return;
        const message = err.response?.status === 401 ? 'Session expirée. Veuillez vous reconnecter.' : 'Échec de l\'authentification. Veuillez vous reconnecter.';
        setError(prev => ({ ...prev, general: message }));
        showToast(message, 'error');
        handleLogout(); // Use the correct logout function
      } finally {
        if (isMountedRef.current) setLoading(prev => ({ ...prev, auth: false }));
      }
    };
    checkAuthAndFetch();
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]); // Removed other dependencies, initial load should be controlled

  // Pusher/Echo listeners
  useEffect(() => {
    if (!window.Echo || userRole !== 'administrateur') return;
    const adminChannel = window.Echo.private('role.admin');
    const handleAppointmentCreated = (event) => {
      const agentName = `${event.agent?.name || ''} ${event.agent?.last_name || ''}`.trim() || 'un agent';
      const date = new Date(event.date).toLocaleDateString('fr-FR');
      showToast(`📅 Nouveau RDV par ${agentName} le ${date}`, 'info');
      fetchAppointments(0, 1000); // Refetch all appointments
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats if viewing
    };
    const handleClinicQuoteUploaded = (event) => {
      const clinicName = event.clinique?.name || 'Une clinique';
      const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'un patient';
      showToast(`📄 Devis téléchargé par ${clinicName} pour ${patientName}`, 'info');
      fetchAppointments(0, 1000); // Refetch appointments as they might contain quote URLs
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats if viewing
    };
    const handleQuoteSentToPatient = (event) => {
      const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'un patient';
      showToast(`📨 Superviseur a envoyé un devis au patient ${patientName}`, 'info');
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch); // Refetch quotes
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats if viewing
    };
    const handleAppointmentStatusUpdated = (event) => {
      const status = event.status || 'mis à jour';
      const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'le patient';
      showToast(`📌 Statut du RDV pour ${patientName} mis à jour: ${status}`, 'info');
      fetchAppointments(0, 1000); // Update appointment list
    };

    


    adminChannel.listen('.appointment.created', handleAppointmentCreated);
    adminChannel.listen('.clinic.quote.uploaded', handleClinicQuoteUploaded);
    adminChannel.listen('.quote.sent.to.patient', handleQuoteSentToPatient);
    adminChannel.listen('.appointment.status.updated', handleAppointmentStatusUpdated);

    return () => {
      adminChannel.stopListening('.appointment.created', handleAppointmentCreated);
      adminChannel.stopListening('.clinic.quote.uploaded', handleClinicQuoteUploaded);
      adminChannel.stopListening('.quote.sent.to.patient', handleQuoteSentToPatient);
      adminChannel.stopListening('.appointment.status.updated', handleAppointmentStatusUpdated);
      // window.Echo.leave('role.admin'); // Leaving channel might be handled globally or on logout
    };
  }, [userRole, fetchAppointments, fetchQuotes, fetchStatistics, statsMonth, statsYear, activeSection, quotePage, quoteRowsPerPage, debouncedQuoteSearch, showToast]);

  // Effect for fetching statistics when filters change
  useEffect(() => {
    if (userRole === 'administrateur' && !loading.auth && isMountedRef.current) {
      fetchStatistics(statsMonth, statsYear);
    }
  }, [statsMonth, statsYear, granularity, comparePrevious, userRole, loading.auth, fetchStatistics]);


  // Auto Refresh Logic
  useEffect(() => {
    if (!autoRefresh || !isMountedRef.current || activeSection !== 'statistics') return;
    const interval = setInterval(() => {
      showToast('🔄 Rafraîchissement automatique des statistiques...', 'info', 2000);
      fetchStatistics(statsMonth, statsYear);
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, statsMonth, statsYear, fetchStatistics, activeSection, showToast]);


  // --- CRUD Handlers ---
  const handleSaveUser = async () => {
    const isEditing = !!currentUser;
    const userData = isEditing ? { ...currentUser, password: currentUser.password || undefined } : newUser;
    if (!userData.name || !userData.last_name || !userData.email || !userData.role) {
      setError(prev => ({ ...prev, dialog: "Veuillez remplir tous les champs obligatoires." }));
      showToast("Veuillez remplir tous les champs obligatoires.", 'error'); return;
    }
    if (!isEditing && !userData.password) {
      setError(prev => ({ ...prev, dialog: "Le mot de passe est requis pour les nouveaux utilisateurs." }));
      showToast("Le mot de passe est requis pour les nouveaux utilisateurs.", 'error'); return;
    }
    if (userData.password && userData.password.length < 8) {
      setError(prev => ({ ...prev, dialog: "Le mot de passe doit comporter au moins 8 caractères." }));
      showToast("Le mot de passe doit comporter au moins 8 caractères.", 'error'); return;
    }
    setError(prev => ({ ...prev, dialog: null }));
    const url = isEditing ? `/admin/users/${currentUser.id}` : '/admin/users';
    const method = isEditing ? 'put' : 'post';
    try {
      const response = await apiClient[method](url, userData, { headers: { 'Content-Type': 'application/json' } });
      closeUserDialog();
      fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
      showToast(`L'utilisateur "${response.data.name}" a été ${isEditing ? 'mis à jour' : 'créé'} avec succès.`, 'success');
    } catch (err) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} user:`, err.response?.data);
      const errors = err.response?.data?.errors;
      let errorMsg = `Échec de la ${isEditing ? 'mise à jour' : 'création'} de l'utilisateur.`;
      if (errors) {
        errorMsg += " " + Object.values(errors).flat().join(' ');
      } else {
        errorMsg += " " + (err.response?.data?.message || 'Veuillez vérifier les détails et réessayer.');
      }
      setError(prev => ({ ...prev, dialog: errorMsg }));
      showToast(errorMsg, 'error');
    }
  };

  const toggleUserStatus = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    openConfirmationModal({
      title: `${user.is_active ? 'Désactiver' : 'Activer'} Utilisateur`,
      message: `Êtes-vous sûr de vouloir ${user.is_active ? 'désactiver' : 'activer'} ce compte utilisateur ?`,
      confirmText: user.is_active ? 'Désactiver' : 'Activer',
      onConfirm: async () => {
        try {
          const response = await apiClient.post(`/admin/users/${userId}/toggle-status`);
          const isActive = response.data?.is_active;
          showToast(`Compte utilisateur ${isActive ? 'activé' : 'désactivé'}.`, 'success');
          fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
          closeConfirmationModal();
        } catch (err) {
          console.error("Failed to toggle user status:", err);
          showToast("Échec de la modification du statut de l'utilisateur. " + (err.response?.data?.message || ''), 'error');
          setModalLoading(false); // Reset loading in modal on error
        }
      }
    });
  };

  const viewPatientFiles = async (userId) => {
    try {
      const responseFiles = await apiClient.get(`/admin/users/${userId}/patient-files`);
      const files = responseFiles.data;
      if (!files || files.length === 0) {
        showToast('Ce patient n\'a ajouté aucun fichier.', 'info'); return;
      }
      const firstFile = files[0];
      const fileId = firstFile.id;
      const fileName = firstFile.file_name || `dossier_medical_${fileId}.pdf`;
      const token = localStorage.getItem('token');
      const responseBlob = await fetch(`${apiClient.defaults.baseURL}/admin/files/${fileId}/download`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }
      });
      if (!responseBlob.ok) {
        const errorData = await responseBlob.text(); // Try to get error text
        throw new Error(`Échec du téléchargement avec le statut ${responseBlob.status}. ${errorData}`);
      }
      const blob = await responseBlob.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to fetch or download patient files:", err);
      showToast("Échec du téléchargement du fichier patient. " + (err.message || ''), 'error');
    }
  };

  const viewClinicQuote = (url) => { window.open(url, '_blank'); };

  const [availableAppointments, setAvailableAppointments] = useState([]);

  const handleCreateQuote = async () => {
    const { appointment_id, assistance_items, total_clinique } = newQuote;
    if (!appointment_id) {
      showToast("Veuillez sélectionner un rendez-vous pour créer le devis.", 'error'); return;
    }
    if (!total_clinique || isNaN(parseFloat(total_clinique))) {
      showToast("Veuillez saisir un total clinique valide.", 'error'); return;
    }
    if (!assistance_items || assistance_items.length === 0 || assistance_items.some(item => !item.label || isNaN(parseFloat(item.amount)))) {
      showToast("Veuillez compléter tous les éléments d'assistance avec des libellés et des montants valides.", 'error'); return;
    }
    setError(prev => ({ ...prev, dialog: null })); // Clear previous dialog errors
    try {
      const endpoint = currentQuoteId ? `/admin/quotes/${currentQuoteId}` : '/admin/quotes';
      const method = currentQuoteId ? 'put' : 'post';
      await apiClient[method](endpoint, {
        appointment_id,
        total_clinique: parseFloat(total_clinique),
        assistance_items: assistance_items.map(item => ({ label: item.label, amount: parseFloat(item.amount) })),
      });
      showToast(currentQuoteId ? "Devis modifié avec succès !" : "Devis créé avec succès !", 'success');
      closeQuoteDialog(); // Close dialog on success
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
      fetchAppointments(0, 1000); // Refresh appointments as quotes might affect them
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats
    } catch (err) {
      console.error("Failed to create/update quote:", err.response?.data || err.message);
      let msg = currentQuoteId ? 'Échec de la modification du devis.' : 'Échec de la création du devis.';
      if (err.response?.data?.message) msg += ` ${err.response.data.message}`;
      else if (err.response?.data?.errors) msg += ' ' + Object.values(err.response.data.errors).flat().join(' ');
      else msg += ' Une erreur inattendue s\'est produite.';
      setError(prev => ({ ...prev, dialog: msg })); // Set error for dialog
      showToast(msg, 'error'); // Also show toast
    }
  };

  const handleLogout = () => { logout(); };

  // --- Dialog Management ---
  const openUserDialog = (user = null) => {
    setError(prev => ({ ...prev, dialog: null }));
    if (user) {
      const roleName = user.roles?.length > 0 ? user.roles[0].name : (user.role || '');
      setCurrentUser({
        ...user,
        password: '',
        role: roleName,
        telephone: user.telephone || '',
        adresse: user.adresse || ''
      });

      setNewUser({ name: '', last_name: '', email: '', password: '', role: '' }); // Clear newUser
    } else {
      setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
      setCurrentUser(null); // Clear currentUser
    }
    setIsUserDialogOpen(true);
  };
  const closeUserDialog = () => {
    setIsUserDialogOpen(false); setCurrentUser(null);
    setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
    setError(prev => ({ ...prev, dialog: null }));
  };

  const openQuoteDialog = (quoteToModify = null) => {
    setError(prev => ({ ...prev, dialog: null }));
    const quotedAppointmentIds = new Set(
      quotes
        .filter(q => !q.is_clinic && q.appointment_id !== null && q.id !== quoteToModify?.id)
        .map(q => q.appointment_id)
    );
    const available = appointments.filter(appt => !quotedAppointmentIds.has(appt.id) || (quoteToModify && appt.id === quoteToModify.appointment_id));
    setAvailableAppointments(available);
    if (quoteToModify) {
      setCurrentQuoteId(quoteToModify.id);
      setNewQuote({
        appointment_id: quoteToModify.appointment?.id || quoteToModify.appointment_id || '',
        total_clinique: quoteToModify.total_clinique || '',
        assistance_items: quoteToModify.assistance_quotes?.map(aq => ({ label: aq.label, amount: aq.amount })) || [{ label: '', amount: '' }],
      });
    } else {
      setCurrentQuoteId(null);
      setNewQuote({ appointment_id: '', file: null, total_clinique: '', assistance_items: [{ label: '', amount: '' }] });
    }
    setIsQuoteDialogOpen(true);
  };
  const closeQuoteDialog = () => {
    setIsQuoteDialogOpen(false); setCurrentQuoteId(null);
    setNewQuote({ appointment_id: '', file: null, total_clinique: '', assistance_items: [{ label: '', amount: '' }] });
    setError(prev => ({ ...prev, dialog: null }));
  };

  // --- Table Pagination Handlers ---
  const handleChangeUserPage = (newPage) => { fetchUsers(newPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter); };
  const handleChangeUserRowsPerPage = (newLimit) => { fetchUsers(0, newLimit, debouncedUserSearch, selectedRoleFilter); };

  // For client-side paginated appointments view table
  const filteredAppointmentsForTable = useMemo(() => {
    return appointments.filter(appt => {
      return (!statusFilter || appt.status === statusFilter) &&
        (!serviceFilter || appt.service === serviceFilter);
    });
  }, [appointments, statusFilter, serviceFilter]);


  const paginatedAppointmentsForTable = useMemo(() => {
    const start = appointmentViewPage * appointmentViewRowsPerPage;
    const end = start + appointmentViewRowsPerPage;
    return filteredAppointmentsForTable.slice(start, end);
  }, [filteredAppointmentsForTable, appointmentViewPage, appointmentViewRowsPerPage]);


  const handleChangeQuotePage = (newPage) => {
    setQuotePage(newPage); // ✅ update state
    fetchQuotes(newPage, quoteRowsPerPage, debouncedQuoteSearch);
  };

  const handleChangeQuoteRowsPerPage = (newLimit) => {
    setQuoteRowsPerPage(newLimit); // ✅ update state
    setQuotePage(0); // ✅ reset to page 0
    fetchQuotes(0, newLimit, debouncedQuoteSearch);
  };


  // --- Memoized Chart Data ---
  const chartData = useMemo(() => {
    if (!statistics || !Array.isArray(statistics.labels) || !Array.isArray(statistics.datasets)) return [];
    const validDatasets = statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data));
    if (validDatasets.length === 0 && statistics.labels.length > 0) {
      return statistics.labels.map(dayLabel => ({ day: dayLabel })); // Use 'day' as per XAxis dataKey
    }
    return statistics.labels.map((dayLabel, index) => {
      const dataPoint = { day: dayLabel }; // Use 'day' as per XAxis dataKey
      validDatasets.forEach(dataset => { dataPoint[dataset.label] = dataset.data[index] ?? 0; });
      return dataPoint;
    });
  }, [statistics]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchesStatus = !statusFilter || q.status === statusFilter;
      const matchesService = !serviceFilter || q.appointment?.service === serviceFilter;
      return matchesStatus && matchesService && !q.is_clinic;
    });
  }, [quotes, statusFilter, serviceFilter]);

  const paginatedQuotes = useMemo(() => {
    const start = quotePage * quoteRowsPerPage;
    const end = start + quoteRowsPerPage;
    return filteredQuotes.slice(start, end);
  }, [filteredQuotes, quotePage, quoteRowsPerPage]);


  const setSection = (section) => {
    setActiveSection(section);
    if (window.innerWidth < 992) { setSidebarOpen(false); }
  };

  // --- Export Logic ---
  const handleExportAsImage = async () => {
    const element = chartContainerRef.current; // Use ref
    if (!element || typeof html2canvas === 'undefined') {
      showToast('Fonctionnalité d\'exportation non prête ou élément non trouvé.', 'error');
      console.error('html2canvas is not loaded or chart element not found.');
      return;
    }
    try {
      const canvas = await html2canvas(element, { useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = 'statistiques.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Graphique exporté en PNG.', 'success');
    } catch (error) {
      console.error('Error exporting as image:', error);
      showToast('Erreur lors de l\'exportation en PNG.', 'error');
    }
  };

  const handleExportAsPDF = async () => {
    const element = chartContainerRef.current; // Use ref
    if (!element || typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
      showToast('Fonctionnalité d\'exportation non prête ou élément non trouvé.', 'error');
      console.error('html2canvas or jsPDF is not loaded or chart element not found.');
      return;
    }
    try {
      const canvas = await html2canvas(element, { useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] }); // Adjust PDF size to canvas
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('statistiques.pdf');
      showToast('Graphique exporté en PDF.', 'success');
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      showToast('Erreur lors de l\'exportation en PDF.', 'error');
    }
  };


  if (loading.auth) {
    return (<div className="loading-container dashboard-body"><div className="simple-spinner"></div><p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Vérification de l'authentification...</p></div>);
  }
  if (!userRole && !loading.auth) {
    return (<div className="error-container dashboard-body"><p>{error.general || 'Accès refusé. Rôle Administrateur requis.'}</p><button onClick={() => navigate('/login')} className="action-button">Aller à la connexion</button></div>);
  }
  // ✅ SAFE: top-level usage, no condition





  return (
    <>
      {isToastVisible && (<ToastNotification message={toastMessage} type={toastType} />)}
      <ConfirmationModal isOpen={isModalOpen} onClose={closeConfirmationModal} onConfirm={handleModalConfirm} title={modalConfig.title} message={modalConfig.message} confirmText={modalConfig.confirmText || 'Confirmer'} isLoading={modalLoading} />
      <div className="dashboard-body">
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
          <div className="header-title">Tableau de Bord Admin</div>
          <div className="header-actions"><button onClick={handleLogout}>Déconnexion</button></div>
        </header>
        <div className="main-content-wrapper">
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <button className={`sidebar-button ${activeSection === 'statistics' ? 'active' : ''}`} onClick={() => setSection('statistics')}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg> Statistiques</button>
            <button className={`sidebar-button ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setSection('users')}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> Utilisateurs</button>
            <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setSection('appointments')}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Rendez-vous</button>
            <button className={`sidebar-button ${activeSection === 'quotes' ? 'active' : ''}`} onClick={() => setSection('quotes')}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> Devis</button>
          </aside>
          <main className="content-area">
            <div className="content-overlay" onClick={() => setSidebarOpen(false)}></div>
            {error.general && !isUserDialogOpen && !isQuoteDialogOpen && !isModalOpen && (<div className="alert-message alert-message-error"><span>{error.general}</span><button className="alert-close-btn" onClick={() => setError(prev => ({ ...prev, general: null }))}>×</button></div>)}

            {activeSection === 'statistics' && (
              <section className="content-section">
                <div className="section-header"><h3>Statistiques de la Plateforme</h3></div>

                <div className="summary-cards">
                  <div className="summary-card">📅 Total RDVs: {summaryStats.totalRdv}</div>
                  <div className="summary-card">📄 Devis envoyés: {summaryStats.totalQuotes}</div>
                  <div className="summary-card">✅ Acceptation: {summaryStats.acceptedRate.toFixed(2)}%</div>
                </div>

                <div className="filter-controls"> {/* Existing month/year filters */}
                  <div className="form-group"><label htmlFor="stats-month">Mois</label><select id="stats-month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} disabled={loading.stats}>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => (<option key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('fr-FR', { month: 'long' })}</option>))}</select></div>
                  <div className="form-group"><label htmlFor="stats-year">Année</label><select id="stats-year" value={statsYear} onChange={(e) => setStatsYear(e.target.value)} disabled={loading.stats}>{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (<option key={y} value={String(y)}>{y}</option>))}</select></div>
                </div>

                <div className="filter-controls advanced"> {/* New advanced filters */}
                  <div className="form-group">
                    <label htmlFor="granularity-select" className="sr-only">Granularité</label>
                    <select id="granularity-select" value={granularity} onChange={(e) => setGranularity(e.target.value)} disabled={loading.stats}>
                      <option value="daily">Quotidien</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuel</option>
                    </select>
                  </div>
                  <label><input type="checkbox" checked={comparePrevious} onChange={(e) => setComparePrevious(e.target.checked)} disabled={loading.stats} /> 📊 Comparer Période Précédente</label>
                  <label><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> 🔄 Rafraîchissement Auto (60s)</label>
                  <button onClick={handleExportAsImage} disabled={loading.stats || !statistics}>📷 Exporter Image</button>
                  <button onClick={handleExportAsPDF} disabled={loading.stats || !statistics}>📄 Exporter PDF</button>
                  {loading.stats && <div className="simple-spinner" style={{ width: '28px', height: '28px', marginLeft: '10px' }}></div>}
                </div>

                <div className="chart-container" ref={chartContainerRef} style={{ height: '400px', width: '100%' }}> {/* Added ref and ensure dimensions */}
                  {loading.stats ? (<div className="chart-loading-overlay"><div className="simple-spinner"></div></div>)
                    : statistics && chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="day" stroke="var(--text-light)" />
                          <YAxis allowDecimals={false} stroke="var(--text-light)" />
                          <RechartsTooltip formatter={(value, name) => [`${value}`, name]} cursor={{ fill: 'rgba(194, 155, 110, 0.1)' }} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          {statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data)).map((dataset, idx) => {
                            const isComparison = dataset.label.toLowerCase().includes('précédente') || dataset.label.toLowerCase().includes('previous');
                            return isComparison ? (
                              <Line
                                key={dataset.label || idx}
                                type="monotone"
                                dataKey={dataset.label}
                                stroke="#8884d8"
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                strokeDasharray="5 5"
                              />
                            ) : (
                              <Bar
                                key={dataset.label || idx}
                                dataKey={dataset.label}
                                fill={chartColors[idx % chartColors.length]}
                                radius={[4, 4, 0, 0]}
                              />
                            );
                          })}

                          {/* Example Trend Line - ensure 'Rendez-vous' is a valid dataKey in one of your datasets or adjust accordingly */}
                          {/* <Line type="monotone" dataKey="Rendez-vous" stroke="#8884d8" strokeWidth={2} dot={false} /> */}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : error.stats ? (<div className="alert-message alert-message-warning" style={{ margin: 'auto', maxWidth: '400px' }}><span>{error.stats}</span></div>)
                      : (<p style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: '60px', fontSize: '1.1em' }}>Aucune donnée statistique disponible pour la période sélectionnée.</p>)}
                </div>


              </section>
            )}

            {activeSection === 'users' && (
              <section className="content-section">
                <div className="section-header"><h3>Gestion des Utilisateurs</h3><button className="action-button button-small" onClick={() => openUserDialog()}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Ajouter Utilisateur</button></div>
                <div className="filter-controls">
                  <div className="form-group"><label htmlFor="user-search" className="sr-only">Rechercher des utilisateurs</label><input id="user-search" type="text" placeholder="Rechercher Utilisateurs (Nom ou Email)" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} disabled={loading.users} /></div>
                  <div className="form-group"><label htmlFor="role-filter" className="sr-only">Filtrer par rôle</label><select id="role-filter" value={selectedRoleFilter} onChange={(e) => setSelectedRoleFilter(e.target.value)} disabled={loading.users}><option value="">Tous les Rôles</option>{roles.map(role => (<option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>))}</select></div>
                  {loading.users && <div className="simple-spinner" style={{ width: '28px', height: '28px' }}></div>}
                </div>
                {error.users && <div className="alert-message alert-message-warning"><span>{error.users}</span></div>}
                <div className="table-container"><table className="styled-table"><thead><tr><th>Nom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Adresse</th>
                  <th>Rôle(s)</th>
                  <th>Statut</th>
                  <th className="actions-cell">Actions</th>
                </tr></thead>
                  <tbody>
                    {loading.users ? (<tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>)
                      : users.length > 0 ? users.map((user) => (<tr key={user.id}>
                        <td><strong>{user.name} {user.last_name}</strong></td>
                        <td>{user.email}</td>
                        <td>{user.telephone || '-'}</td>
                        <td>{user.adresse || '-'}</td>
                        <td>{user.roles?.map(r => r.name).join(', ') || user.role || 'N/D'}</td>
                        <td><span className={user.is_active ? 'status-active' : 'status-inactive'}>{user.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td className="actions-cell">
                          <button className="action-button button-small button-icon-only button-outline" onClick={() => openUserDialog(user)} title="Modifier Utilisateur" aria-label="Modifier utilisateur"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg></button>
                          <button className={`action-button button-small ${user.is_active ? 'button-warning' : 'button-success'}`} onClick={() => toggleUserStatus(user.id)} title={user.is_active ? 'Désactiver Utilisateur' : 'Activer Utilisateur'} style={{ minWidth: '95px' }}>{user.is_active ? 'Désactiver' : 'Activer'}</button>
                          {user.roles?.some(r => r.name === 'patient') && (<button className="action-button button-small button-outline" onClick={() => viewPatientFiles(user.id)} title="Voir Fichiers Patient" style={{ minWidth: '90px' }}>Voir PDFs</button>)}
                        </td></tr>)) : (<tr className="no-results-row"><td colSpan="5">Aucun utilisateur trouvé correspondant aux critères.</td></tr>)}
                  </tbody></table></div><CustomPagination count={userTotalRows} rowsPerPage={userRowsPerPage} page={userPage} onPageChange={handleChangeUserPage} onRowsPerPageChange={handleChangeUserRowsPerPage} rowsPerPageOptions={userRowsPerPageOptions} />
              </section>
            )}

            {activeSection === 'appointments' && (
              <section className="content-section">
                <div className="section-header"><h3>Aperçu des Rendez-vous</h3></div>

                {/* Filters */}
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="status-filter" className="sr-only">Filtrer par statut</label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setAppointmentViewPage(0);
                      }}
                    >
                      <option value="">Tous les Statuts</option>
                      {Array.from(new Set(appointments.map(a => a.status).filter(Boolean))).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="service-filter" className="sr-only">Filtrer par service</label>
                    <select
                      id="service-filter"
                      value={serviceFilter}
                      onChange={(e) => {
                        setServiceFilter(e.target.value);
                        setAppointmentViewPage(0);
                      }}
                    >
                      <option value="">Tous les Services</option>
                      {Array.from(new Set(appointments.map(a => a.service).filter(Boolean))).map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error.appointments && (
                  <div className="alert-message alert-message-warning">
                    <span>{error.appointments}</span>
                  </div>
                )}

                <div className="table-container responsive">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Prénom</th>
                        <th>Nom</th>
                        <th>Téléphone</th>
                        <th>Email</th>
                        <th>Service</th>
                        <th>Type de Soins</th>
                        <th>Date RDV</th>
                        <th>Date Intervention</th>
                        <th>Objectif</th>
                        <th>Qualification</th>
                        <th>Prise en charge</th>
                        <th>Budget</th>
                        <th>Agent Comment</th>
                        <th>Status</th>
                        <th>Devis Clinique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.appointments && !paginatedAppointmentsForTable.length ? (
                        <tr>
                          <td colSpan="16" style={{ textAlign: 'center', padding: '30px' }}>
                            <div className="simple-spinner" style={{ margin: 'auto' }}></div>
                          </td>
                        </tr>
                      ) : paginatedAppointmentsForTable.length > 0 ? (
                        paginatedAppointmentsForTable.map(appt => (
                          <tr key={appt.id}>
                            <td>{appt.agent?.name || '-'}</td>
                            <td>{appt.prenom_du_prospect || '-'}</td>
                            <td>{appt.nom_du_prospect || '-'}</td>
                            <td>{appt.telephone || '-'}</td>
                            <td>{appt.email || '-'}</td>
                            <td>{appt.service || '-'}</td>
                            <td>{appt.type_de_soins || '-'}</td>
                            <td>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleDateString('fr-FR') : '-'}</td>
                            <td>{appt.date_intervention ? new Date(appt.date_intervention).toLocaleDateString('fr-FR') : '-'}</td>
                            <td>{appt.objectif || '-'}</td>
                            <td>{appt.qualification || '-'}</td>
                            <td>{appt.prise_en_charge || '-'}</td>
                            <td>{appt.budget || '-'}</td>
                            <td>{appt.agent_comment || '-'}</td>
                            <td>
                              <span className={`status-badge ${appt.status?.toLowerCase().replace(/\s+/g, '-') || 'default'}`}>
                                {appt.status || 'N/D'}
                              </span>
                            </td>
                            <td>
                              {appt.clinic_quote_url ? (
                                <a href={appt.clinic_quote_url} target="_blank" rel="noopener noreferrer" className="quote-link-icon" title="Voir Devis Clinique">📄</a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="no-results-row">
                          <td colSpan="16">Aucun rendez-vous trouvé.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <CustomPagination
                  count={filteredAppointmentsForTable.length}
                  rowsPerPage={appointmentViewRowsPerPage}
                  page={appointmentViewPage}
                  onPageChange={setAppointmentViewPage}
                  onRowsPerPageChange={(newLimit) => {
                    setAppointmentViewRowsPerPage(newLimit);
                    setAppointmentViewPage(0);
                  }}
                  rowsPerPageOptions={appointmentViewRowsPerPageOptions}
                />
              </section>
            )}


            {activeSection === 'quotes' && (
              <section className="content-section">
                <div className="section-header">
                  <h3>Devis Récents</h3>
                  <button className="action-button button-small" onClick={() => openQuoteDialog()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg> Ajouter Devis
                  </button>
                </div>

                <div className="filter-controls">
                  <div className="form-group">
                    <input id="quote-search" type="text" placeholder="Rechercher Devis (Nom/Email/Service/ID)" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} disabled={loading.quotes} />
                  </div>
                  <div className="form-group">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} disabled={loading.quotes}>
                      <option value="">Tous les Statuts</option>
                      {Array.from(new Set(quotes.map(q => q.status).filter(Boolean))).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} disabled={loading.quotes}>
                      <option value="">Tous les Services</option>
                      {Array.from(new Set(quotes.map(q => q.appointment?.service).filter(Boolean))).map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </select>
                  </div>
                  {loading.quotes && <div className="simple-spinner" style={{ width: '28px', height: '28px' }}></div>}
                </div>

                {error.quotes && <div className="alert-message alert-message-warning"><span>{error.quotes}</span></div>}

                <div className="table-container">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Prospect (RDV)</th>
                        <th>Date Création</th>
                        <th>Total Clinique</th>
                        <th>Statut</th>
                        <th>Commentaire</th>
                        <th style={{ textAlign: 'center' }}>Action PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.quotes ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                            <div className="simple-spinner" style={{ margin: 'auto' }}></div>
                          </td>
                        </tr>
                      ) : paginatedQuotes.length > 0 ? (
                        paginatedQuotes.map(quote => (
                          <tr key={quote.id}>
                            <td>{quote.id}</td>
                            <td>
                              <strong>
                                {quote.appointment
                                  ? `${quote.appointment.prenom_du_prospect || ''} ${quote.appointment.nom_du_prospect || ''}`
                                  : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Aucun Rendez-vous</span>}
                              </strong>
                            </td>
                            <td>{quote.created_at ? new Date(quote.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                            <td>{quote.total_clinique ? `${Number(quote.total_clinique).toFixed(2)} DT` : '-'}</td>
                            <td>
                              <span className={`status-badge ${quote.status?.toLowerCase() || 'nd'}`}>
                                {quote.status === 'accepted' ? '✅ Accepté' :
                                  quote.status === 'refused' ? '❌ Refusé' :
                                    quote.status === 'pending' ? '⏳ En attente' :
                                      quote.status || 'N/D'}
                              </span>
                            </td>
                            <td className="comment-cell" data-tooltip={quote.status === 'refused' ? (quote.comment || 'Aucun commentaire fourni') : ''}>
                              {quote.status === 'refused'
                                ? (quote.comment || <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Aucun commentaire</span>)
                                : '-'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="action-button button-small button-outline"
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  const previewUrl = `${apiClient.defaults.baseURL}/admin/quotes/${quote.id}/preview`;
                                  window.open(`${previewUrl}?token=${token}`, '_blank');
                                }}
                              >
                                👁️ Voir PDF
                              </button>

                              {!quote.sent_to_patient_at ? (
                                <button
                                  className="action-button button-small button-outline"
                                  onClick={async () => {
                                    try {
                                      const token = localStorage.getItem('token');
                                      const response = await fetch(`${apiClient.defaults.baseURL}/admin/quotes/${quote.id}/send-to-patient`, {
                                        method: 'POST',
                                        headers: {
                                          Authorization: `Bearer ${token}`,
                                          Accept: 'application/json',
                                        },
                                      });

                                      if (!response.ok) {
                                        const errorData = await response.json();
                                        throw new Error(errorData?.error || 'Erreur lors de l\'envoi du devis');
                                      }

                                      showToast("✅ Devis exporté et envoyé au patient", "success");
                                      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
                                    } catch (err) {
                                      console.error(err);
                                      showToast("❌ Erreur lors de l'envoi : " + err.message, "error");
                                    }
                                  }}
                                >
                                  Exporter & Envoyer
                                </button>

                              ) : (
                                <>
                                  <span style={{ color: '#999', fontStyle: 'italic', display: 'block' }}>Devis Envoyé</span>
                                  <button
                                    className="action-button button-small button-warning"
                                    onClick={() => {
                                      openConfirmationModal({
                                        title: 'Re-exporter le Devis ?',
                                        message: 'Ce devis a déjà été envoyé. Voulez-vous quand même le re-télécharger ?',
                                        confirmText: 'Oui, Re-exporter',
                                        onConfirm: async () => {
                                          try {
                                            const token = localStorage.getItem('token');
                                            const exportUrl = `${apiClient.defaults.baseURL}/admin/quotes/${quote.id}/export-pdf`;
                                            const response = await fetch(exportUrl, {
                                              headers: { Authorization: `Bearer ${token}` },
                                            });
                                            if (!response.ok) throw new Error('Erreur export PDF');
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `devis_facture_${quote.id}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(url);
                                            showToast("PDF re-exporté avec succès", "success");
                                          } catch (err) {
                                            console.error(err);
                                            showToast("Erreur lors de la re-exportation du PDF", "error");
                                          } finally {
                                            closeConfirmationModal();
                                          }
                                        }
                                      });
                                    }}
                                  >
                                    ♻ Re-exporter
                                  </button>
                                </>
                              )}
                            </td>

                          </tr>
                        ))
                      ) : (
                        <tr className="no-results-row">
                          <td colSpan="7">Aucun devis trouvé.</td>
                        </tr>
                      )}
                    </tbody>

                  </table>
                </div>

                <CustomPagination
                  count={quoteTotalRows}
                  rowsPerPage={quoteRowsPerPage}
                  page={quotePage}
                  onPageChange={handleChangeQuotePage}
                  onRowsPerPageChange={handleChangeQuoteRowsPerPage}
                  rowsPerPageOptions={quoteRowsPerPageOptions}
                />
              </section>
            )}

          </main>
        </div>
      </div>

      <FormDialog isOpen={isUserDialogOpen} onClose={closeUserDialog} title={currentUser ? 'Modifier Utilisateur' : 'Ajouter Nouveau Utilisateur'} actions={<><button onClick={closeUserDialog} className="modal-button cancel-button">Annuler</button><button onClick={handleSaveUser} className="modal-button confirm-button">{currentUser ? 'Enregistrer Modifications' : 'Créer Utilisateur'}</button></>}>
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '20px' }}><span>{error.dialog}</span></div>}
        <div className="form-grid">
          <div className="form-group"><label htmlFor="name">Prénom *</label><input required id="name" name="name" type="text" value={currentUser ? currentUser.name : newUser.name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })} autoFocus /></div>
          <div className="form-group"><label htmlFor="last_name">Nom *</label><input required id="last_name" name="last_name" type="text" value={currentUser ? currentUser.last_name : newUser.last_name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, last_name: e.target.value }) : setNewUser({ ...newUser, last_name: e.target.value })} /></div>
        </div>
        <div className="form-group"><label htmlFor="email">Adresse Email *</label><input required id="email" name="email" type="email" value={currentUser ? currentUser.email : newUser.email} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="password">{currentUser ? 'Nouveau Mot de Passe' : 'Mot de Passe *'}</label><input id="password" name="password" type="password" value={currentUser ? currentUser.password : newUser.password} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })} /><small>{currentUser ? 'Laisser vide pour conserver le mot de passe actuel.' : 'Min 8 caractères. Un email de configuration sera envoyé.'}</small></div>
        <div className="form-group">
          <label htmlFor="telephone">Téléphone</label>
          <input
            id="telephone"
            name="telephone"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            value={currentUser ? currentUser.telephone : newUser.telephone}
            onChange={(e) =>
              currentUser
                ? setCurrentUser({ ...currentUser, telephone: e.target.value.replace(/\D/g, '') })
                : setNewUser({ ...newUser, telephone: e.target.value.replace(/\D/g, '') })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="adresse">Adresse</label>
          <input
            id="adresse"
            name="adresse"
            type="text"
            value={currentUser ? currentUser.adresse : newUser.adresse}
            onChange={(e) =>
              currentUser
                ? setCurrentUser({ ...currentUser, adresse: e.target.value })
                : setNewUser({ ...newUser, adresse: e.target.value })
            }
          />
        </div>

        <div className="form-group"><label htmlFor="role-select">Rôle *</label><select required id="role-select" value={currentUser ? currentUser.role : newUser.role} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}><option value="" disabled>Sélectionner Rôle</option>{roles.map(role => (<option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>))}</select></div>
      </FormDialog>

      <FormDialog isOpen={isQuoteDialogOpen} onClose={closeQuoteDialog} title={currentQuoteId ? 'Modifier Devis' : 'Ajouter Nouveau Devis'} actions={<><button onClick={closeQuoteDialog} className="modal-button cancel-button">Annuler</button><button onClick={handleCreateQuote} className="modal-button confirm-button">{currentQuoteId ? 'Enregistrer Devis' : 'Créer Devis'}</button></>}>
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '20px' }}><span>{error.dialog}</span></div>}
        <div className="form-group">
          <label htmlFor="appt-select">Rendez-vous *</label>
          {currentQuoteId && newQuote.appointment_id ? (<div className="readonly-appointment-label"><strong>{appointments.find(appt => String(appt.id) === String(newQuote.appointment_id))?.prenom_du_prospect || 'Prospect'} {appointments.find(appt => String(appt.id) === String(newQuote.appointment_id))?.nom_du_prospect || ''}</strong>{' (ID: '}{newQuote.appointment_id}{')'}</div>)
            : (<select id="appt-select" value={newQuote.appointment_id} onChange={(e) => setNewQuote({ ...newQuote, appointment_id: e.target.value })} required disabled={!!currentQuoteId}><option value="" disabled>Sélectionner un Rendez-vous</option>
              {loading.appointments ? (<option value="" disabled>Chargement des rendez-vous...</option>)
                : availableAppointments.length > 0 ? (availableAppointments.map((appt) => (<option key={appt.id} value={appt.id}>{`${appt.prenom_du_prospect || ''} ${appt.nom_du_prospect || ''}`.trim()}{appt.date_du_rdv ? ` (${new Date(appt.date_du_rdv).toLocaleDateString('fr-FR')})` : ''}{` - ID: ${appt.id}`}</option>)))
                  : (<option value="" disabled>Aucun rendez-vous disponible.</option>)}</select>)}
        </div>
        <div className="form-group"><label>Génération du Devis</label><p style={{ fontSize: '0.95em', color: 'var(--text-light)' }}>Le PDF du devis sera généré automatiquement en utilisant le rendez-vous sélectionné et les éléments d'assistance.</p></div>
        <div className="form-group"><label htmlFor="total_clinique">Total Clinique *</label><input id="total_clinique" type="number" step="0.01" placeholder="Saisir total clinique" value={newQuote.total_clinique} onChange={(e) => setNewQuote({ ...newQuote, total_clinique: e.target.value })} required /></div>
        <div className="form-group">
          <label>Éléments d'Assistance *</label>
          {newQuote.assistance_items.map((item, index) => (<div key={index} className="form-group-inline">
            <input type="text" placeholder="Libellé" value={item.label} onChange={(e) => { const updatedItems = [...newQuote.assistance_items]; updatedItems[index].label = e.target.value; setNewQuote({ ...newQuote, assistance_items: updatedItems }); }} required />
            <input type="number" placeholder="Montant" value={item.amount} onChange={(e) => { const updatedItems = [...newQuote.assistance_items]; updatedItems[index].amount = e.target.value; setNewQuote({ ...newQuote, assistance_items: updatedItems }); }} required step="0.01" />
            <button type="button" onClick={() => { if (newQuote.assistance_items.length > 1) { const updatedItems = [...newQuote.assistance_items]; updatedItems.splice(index, 1); setNewQuote({ ...newQuote, assistance_items: updatedItems }); } }} style={{ marginLeft: '10px' }} title="Supprimer" disabled={newQuote.assistance_items.length <= 1}>❌</button>
          </div>))}
          <button type="button" onClick={() => { setNewQuote({ ...newQuote, assistance_items: [...newQuote.assistance_items, { label: '', amount: '' }] }); }} className="action-button button-small" style={{ marginTop: '10px' }}>+ Ajouter Élément</button>
        </div>
      </FormDialog>
    </>
  );
}

// --- Custom Pagination Component ---
const CustomPagination = ({ count, rowsPerPage, page, onPageChange, onRowsPerPageChange, rowsPerPageOptions }) => {
  const totalPages = Math.ceil(count / rowsPerPage);
  const startRow = count === 0 ? 0 : page * rowsPerPage + 1;
  const endRow = Math.min(count, (page + 1) * rowsPerPage);

  const handlePreviousPage = () => { if (page > 0) { onPageChange(page - 1); } };
  const handleNextPage = () => { if (page < totalPages - 1) { onPageChange(page + 1); } };
  const handleRowsPerPageChange = (event) => { const newLimit = parseInt(event.target.value, 10); onRowsPerPageChange(newLimit); };

  return (
    <div className="pagination-controls">
      <div className="pagination-info">
        <span>Lignes par page :</span>
        <select className="pagination-rows-select" value={rowsPerPage} onChange={handleRowsPerPageChange} aria-label="Lignes par page">{rowsPerPageOptions.map(option => (<option key={option} value={option}>{option}</option>))}</select>
        <span style={{ marginLeft: '15px', fontWeight: '500' }}>{startRow}-{endRow} sur {count}</span>
      </div>
      <div className="pagination-buttons">
        <button onClick={handlePreviousPage} disabled={page === 0 || count === 0} aria-label="Page précédente"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Préc.</button>
        <button onClick={handleNextPage} disabled={page >= totalPages - 1 || count === 0} aria-label="Page suivante">Suiv. <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
      </div>
    </div>
  );
};

export default Dashboard;
