import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Assuming react-router-dom v6+
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Line } from 'recharts'; // Added Line
import { useDebounce } from 'react-use'; // Assuming react-use is available
import axios from 'axios';
import html2canvas from 'html2canvas'; // Ensure this is installed: npm install html2canvas
import jsPDF from 'jspdf'; // Ensure this is installed: npm install jspdf
import './dashboard.css';
// --- IMPORT THE CSS FILE ---
// Make sure you have a corresponding CSS file (e.g., dashboard.css)
// import './dashboard.css'; // Adjust path if css file is in a different directory
// Add the necessary CSS styles from the Admin Dashboard example to your dashboard.css
/*
Add styles for:
.status-badge.pending, .status-badge.confirmed, etc.
.quote-link-icon
.table-container.responsive
.loading-container, .error-container
.simple-spinner
.dashboard-body, .dashboard-header, .menu-toggle, .header-title, .header-actions
.main-content-wrapper, .sidebar, .sidebar.open, .sidebar-button, .sidebar-button.active
.content-area, .content-overlay
.alert-message, .alert-close-btn
.content-section, .section-header
.filter-controls, .form-group, .filter-controls.advanced
.chart-container, .chart-loading-overlay
.summary-cards, .summary-card
.table-container, .styled-table, .actions-cell, .no-results-row, .comment-cell
.pagination-controls, .pagination-info, .pagination-rows-select, .pagination-buttons
.modal-overlay, .modal-content, .modal-title, .modal-message, .modal-actions, .modal-button, .confirm-button, .cancel-button, .button-spinner
.form-dialog-content, .modal-body, .form-grid
.toast-notification, .toast-icon, .toast-message
.status-active, .status-inactive
.button-small, .button-icon-only, .button-outline, .button-warning, .button-success
.readonly-appointment-label
.form-group-inline
/* Add any other specific styles needed */



// --- Axios Client Setup ---
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api', // Ensure this points to your API base
  headers: {
    'Accept': 'application/json',
  }
});

// Add Authorization token interceptor
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// --- Helper Hook for Auth/Logout ---
const useAuth = () => {
  const navigate = useNavigate();
  const logout = useCallback(() => {
    console.log("Logging out (Supervisor)..."); // Dev log
    localStorage.removeItem('token');
    navigate('/login'); // Redirect to login page
  }, [navigate]);
  return { logout };
};

// --- Reusable Toast Notification Component ---
const ToastNotification = ({ message, type }) => {
  if (!message) return null;
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
            {isLoading ? (<div className="button-spinner"></div>) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Reusable Form Dialog Component ---
const FormDialog = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;
  return (
    <div className={`modal-overlay ${!isOpen ? 'closing' : ''}`} onClick={onClose}>
      <div className="modal-content form-dialog-content" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
};

// --- Main SupervisorDashboard Component ---
function SupervisorDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const chartContainerRef = useRef(null); // Ref for chart container export

  // --- State Variables ---
  const [userRole, setUserRole] = useState(null); // Should be 'superviseur'
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [quotes, setQuotes] = useState([]);

  // User Pagination & Filtering
  const [userPage, setUserPage] = useState(0);
  const [userRowsPerPage, setUserRowsPerPage] = useState(10);
  const [userTotalRows, setUserTotalRows] = useState(0);
  const userRowsPerPageOptions = useMemo(() => [5, 10, 25, 50], []);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(''); // Supervisor might have limited roles to filter

  // Appointment Data Fetching & Display Pagination/Filtering
  const [appointmentFetchPage, setAppointmentFetchPage] = useState(0); // For initial fetch if needed
  const [appointmentFetchRowsPerPage, setAppointmentFetchRowsPerPage] = useState(1000); // Fetch many for client-side filtering
  const [appointmentViewPage, setAppointmentViewPage] = useState(0); // For the displayed table
  const [appointmentViewRowsPerPage, setAppointmentViewRowsPerPage] = useState(10); // For the displayed table
  const appointmentViewRowsPerPageOptions = useMemo(() => [5, 10, 25, 50, 100], []);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState(''); // Filter for display table
  const [appointmentServiceFilter, setAppointmentServiceFilter] = useState(''); // Filter for display table

  // Quote Pagination & Filtering
  const [quotePage, setQuotePage] = useState(0);
  const [quoteRowsPerPage, setQuoteRowsPerPage] = useState(10);
  const [quoteTotalRows, setQuoteTotalRows] = useState(0);
  const quoteRowsPerPageOptions = useMemo(() => [5, 10, 25], []);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [debouncedQuoteSearch, setDebouncedQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState(''); // Filter for display table
  const [quoteServiceFilter, setQuoteServiceFilter] = useState(''); // Filter for display table


  // Statistics Filters & State
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
  const [granularity, setGranularity] = useState('daily'); // daily, weekly, monthly
  const [comparePrevious, setComparePrevious] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 }); // Example summary stats

  // Loading & Error State
  const [loading, setLoading] = useState({ users: false, appointments: false, stats: false, quotes: false, auth: true });
  const [error, setError] = useState({ users: null, appointments: null, stats: null, quotes: null, general: null, dialog: null });

  // Dialog/Modal State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // User being edited
  const [newUser, setNewUser] = useState({ name: '', last_name: '', email: '', password: '', role: '', telephone: '', adresse: '' }); // New user form
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({ appointment_id: '', total_clinique: '', assistance_items: [{ label: '', amount: '' }] }); // New/Edit quote form
  const [currentQuoteId, setCurrentQuoteId] = useState(null); // Quote being edited
  const [availableAppointments, setAvailableAppointments] = useState([]); // For quote dialog dropdown
  const [isModalOpen, setIsModalOpen] = useState(false); // Confirmation modal
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', onConfirm: () => { } });
  const [modalLoading, setModalLoading] = useState(false);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('statistics'); // Default section
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isToastVisible, setIsToastVisible] = useState(false);

  // Configuration (Roles supervisor can manage/see, adjust as needed)
  const manageableRoles = useMemo(() => ['agent', 'confirmateur', 'patient', 'clinique'], []); // Roles supervisor can potentially create/filter
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
      setTimeout(() => setToastMessage(''), 500); // Clear message after fade out
    }, duration);
  }, []);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const openConfirmationModal = useCallback(({ title, message, onConfirm, confirmText = 'Confirmer' }) => {
    if (!isMountedRef.current) return;
    setError(prev => ({ ...prev, dialog: null })); // Clear dialog error when opening modal
    setModalConfig({ title, message, onConfirm, confirmText });
    setIsModalOpen(true);
  }, []);

  const closeConfirmationModal = useCallback(() => {
    setIsModalOpen(false);
    setModalLoading(false);
    // Reset modal config after animation
    setTimeout(() => setModalConfig({ title: '', message: '', onConfirm: () => { } }), 300);
  }, []);

  const handleModalConfirm = useCallback(async () => {
    if (typeof modalConfig.onConfirm === 'function') {
      setModalLoading(true);
      setError(prev => ({ ...prev, dialog: null })); // Clear dialog error
      try {
        await modalConfig.onConfirm();
        // Success: onConfirm should handle closing the modal or showing success toast
      } catch (error) {
        console.error("Modal confirmation action failed:", error); // Dev log
        const errorMessage = error.message || 'Une erreur inattendue s\'est produite lors de la confirmation.';
        setError(prev => ({ ...prev, dialog: errorMessage })); // Show error in potential underlying dialog
        showToast(errorMessage, 'error');
        setModalLoading(false); // Stop loading indicator on error
        // Optionally close modal on error or let user retry/cancel
        // closeConfirmationModal();
      }
      // Note: Modal doesn't close automatically here. The onConfirm function should call closeConfirmationModal on success.
    } else {
      closeConfirmationModal(); // Close if no confirm action defined
    }
  }, [modalConfig, closeConfirmationModal, showToast]);

  // --- Data Fetching Functions ---
  const fetchUsers = useCallback(async (page = 0, limit = 10, search = '', role = '') => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, users: true }));
    setError(prev => ({ ...prev, users: null }));
    try {
      const apiPage = page + 1; // API pagination might be 1-based
      const queryParams = new URLSearchParams({ page: apiPage, limit: limit, search: search });
      if (role) queryParams.append('role', role);
      // *** USE SUPERVISOR ENDPOINT ***
      const response = await apiClient.get(`/superviseur/users?${queryParams.toString()}`);
      if (!isMountedRef.current) return;

      const responseData = response.data?.data || [];
      const total = response.data?.total || 0;
      const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0; // Adjust to 0-based
      let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;

      // Ensure perPage is a valid option
      if (!userRowsPerPageOptions.includes(perPage)) {
        perPage = userRowsPerPageOptions.includes(limit) ? limit : userRowsPerPageOptions[1]; // Default to 10 if invalid
      }

      setUsers(responseData);
      setUserTotalRows(total);
      setUserPage(currentPage);
      setUserRowsPerPage(perPage);

    } catch (err) {
      console.error("Failed to fetch users (Supervisor):", err); // Dev log
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, users: 'Échec de la récupération des utilisateurs.' }));
      showToast('Échec du chargement des utilisateurs. Veuillez essayer de rafraîchir.', 'error');
      setUsers([]); setUserTotalRows(0); // Reset state on error
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, users: false }));
    }
  }, [userRowsPerPageOptions, showToast]); // Dependencies for the fetch function

  const fetchAppointments = useCallback(async (page = 0, limit = 1000) => { // Fetch a large number for client-side filtering
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, appointments: true }));
    setError(prev => ({ ...prev, appointments: null }));
    try {
      const apiPage = page + 1;
      // *** USE SUPERVISOR ENDPOINT ***
      const response = await apiClient.get(`/superviseur/appointments?page=${apiPage}&limit=${limit}`);
      if (!isMountedRef.current) return;
      setAppointments(response.data?.data || []);
      setAppointmentViewPage(0); // Reset display page when data refreshes
    } catch (err) {
      console.error("Failed to fetch appointments (Supervisor):", err); // Dev log
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, appointments: 'Échec de la récupération des rendez-vous.' }));
      showToast('Échec du chargement des rendez-vous.', 'error');
      setAppointments([]); // Reset state on error
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, appointments: false }));
    }
  }, [showToast]); // Dependencies

  const fetchQuotes = useCallback(async (page = 0, limit = 10, search = '') => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, quotes: true }));
    setError(prev => ({ ...prev, quotes: null }));
    try {
      const apiPage = page + 1;
      // *** USE SUPERVISOR ENDPOINT ***
      const quotesRes = await apiClient.get(`/superviseur/quotes?page=${apiPage}&limit=${limit}&search=${search}`);
      if (!isMountedRef.current) return;

      // Handle potential variations in API response structure
      const responseData = quotesRes.data;
      const quotesData = Array.isArray(responseData.data) ? responseData.data : (responseData.data?.data || []); // Adapt based on actual response
      const total = responseData.total || responseData.data?.total || 0;
      const currentPage = responseData.current_page ? responseData.current_page - 1 : (responseData.data?.current_page ? responseData.data.current_page - 1 : 0);
      let perPage = responseData.per_page ? Number(responseData.per_page) : (responseData.data?.per_page ? Number(responseData.data.per_page) : limit);

      if (!quoteRowsPerPageOptions.includes(perPage)) {
        perPage = quoteRowsPerPageOptions.includes(limit) ? limit : quoteRowsPerPageOptions[1]; // Default to 10
      }

      setQuotes(quotesData);
      setQuoteTotalRows(total);
      setQuotePage(currentPage);
      setQuoteRowsPerPage(perPage);

    } catch (err) {
      console.error("Failed to fetch quotes (Supervisor):", err); // Dev log
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, quotes: 'Échec de la récupération des devis.' }));
      showToast('Échec du chargement des devis.', 'error');
      setQuotes([]); setQuoteTotalRows(0); setQuotePage(0); // Reset state on error
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, quotes: false }));
    }
  }, [quoteRowsPerPageOptions, showToast]); // Dependencies

  // Updated fetchStatistics Function for Supervisor
  const fetchStatistics = useCallback(async (month, year) => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, stats: true }));
    setError(prev => ({ ...prev, stats: null }));
    try {
      // *** USE SUPERVISOR ENDPOINT ***
      const response = await apiClient.get(`/superviseur/statistics`, {
        params: {
          month,
          year,
          granularity, // Pass granularity
          compare_previous: comparePrevious ? 1 : 0, // Pass comparison flag
        },
      });
      if (!isMountedRef.current) return;
      const data = response.data;
      // Validate response structure (adjust based on actual API)
      if (data && Array.isArray(data.labels) && Array.isArray(data.datasets)) {
        setStatistics(data);
        // Update summary stats if provided by the backend
        setSummaryStats({
          totalRdv: data.total_appointments || 0,
          totalQuotes: data.total_quotes || 0, // Assuming backend provides this
          acceptedRate: data.accepted_percentage || 0, // Assuming backend provides this
        });
      } else {
        console.warn("Statistics API response format unexpected (Supervisor).", data); // Dev log
        setError(prev => ({ ...prev, stats: 'Format des données statistiques incorrect.' }));
        setStatistics(null); // Clear previous stats
        setSummaryStats({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 }); // Reset summary
        showToast("Format des statistiques reçu inattendu.", 'error');
      }
    } catch (err) {
      console.error("Failed to fetch statistics (Supervisor):", err); // Dev log
      if (!isMountedRef.current) return;
      const statusText = err.response?.status ? `(Code: ${err.response.status})` : '(Erreur réseau)';
      setError(prev => ({ ...prev, stats: `Échec de la récupération des statistiques ${statusText}.` }));
      showToast("Impossible de charger les statistiques.", 'error');
      setStatistics(null); // Clear previous stats
      setSummaryStats({ totalRdv: 0, totalQuotes: 0, acceptedRate: 0 }); // Reset summary
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [granularity, comparePrevious, showToast]); // Dependencies

  // --- Debounce Hooks ---
  useDebounce(() => {
    setDebouncedUserSearch(userSearch);
  }, 500, [userSearch]);

  useEffect(() => { // Fetch users when debounced search or filters change
    if (userRole === 'superviseur' && !loading.auth && isMountedRef.current) {
      fetchUsers(0, userRowsPerPage, debouncedUserSearch, selectedRoleFilter); // Reset to page 0 on filter change
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUserSearch, userRowsPerPage, selectedRoleFilter, userRole, loading.auth, fetchUsers]); // Add fetchUsers dependency

  useDebounce(() => {
    setDebouncedQuoteSearch(quoteSearch);
  }, 500, [quoteSearch]);

  useEffect(() => { // Fetch quotes when debounced search changes
    if (userRole === 'superviseur' && !loading.auth && isMountedRef.current) {
      fetchQuotes(0, quoteRowsPerPage, debouncedQuoteSearch); // Reset to page 0 on search change
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuoteSearch, quoteRowsPerPage, userRole, loading.auth, fetchQuotes]); // Add fetchQuotes dependency


  // --- Authorization and Initial Data Fetch ---
  useEffect(() => {
    isMountedRef.current = true;
    const checkAuthAndFetch = async () => {
      if (!isMountedRef.current) return;
      setLoading(prev => ({ ...prev, auth: true }));
      setError(prev => ({ ...prev, general: null }));
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login'); // Redirect if no token
        return;
      }
      try {
        // Verify token and get user role
        const response = await apiClient.get('/user'); // Generic endpoint to get user info
        if (!isMountedRef.current) return;

        // *** CHECK FOR SUPERVISOR ROLE ***
        const isSupervisor = response.data?.roles?.some(role => role.name === 'superviseur');

        if (isSupervisor) {
          setUserRole('superviseur');
          // Fetch initial data required for the dashboard
          await Promise.all([
            fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter),
            fetchAppointments(appointmentFetchPage, appointmentFetchRowsPerPage), // Fetch appointments
            fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch), // Fetch quotes
            fetchStatistics(statsMonth, statsYear) // Fetch initial stats
          ]);
        } else {
          // If not a supervisor, show error and log out
          setError(prev => ({ ...prev, general: 'Accès refusé : Rôle superviseur requis.' }));
          showToast('Accès refusé : Rôle superviseur requis.', 'error');
          handleSupervisorLogout(); // Use the specific logout handler
        }
      } catch (err) {
        console.error("Auth check failed (Supervisor):", err); // Dev log
        if (!isMountedRef.current) return;
        const message = err.response?.status === 401
          ? 'Session expirée. Veuillez vous reconnecter.'
          : 'Échec de l\'authentification. Veuillez vous reconnecter.';
        setError(prev => ({ ...prev, general: message }));
        showToast(message, 'error');
        handleSupervisorLogout(); // Use the specific logout handler on auth error
      } finally {
        if (isMountedRef.current) setLoading(prev => ({ ...prev, auth: false }));
      }
    };
    checkAuthAndFetch();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]); // Only run on mount/navigate change

  // --- Pusher/Echo Event Listeners ---
  useEffect(() => {
    // Ensure Echo is initialized and user is a supervisor
    if (!window.Echo || userRole !== 'superviseur') return;

    // *** LISTEN ON SUPERVISOR CHANNEL ***
    const supervisorChannel = window.Echo.private('role.superviseur'); // Use the correct channel name

    // Handler for new appointments relevant to supervisors
    const handleAppointmentCreated = (event) => {
      console.log('Pusher: appointment.created received (Supervisor)', event); // Dev log
      const agentName = `${event.agent?.name || ''} ${event.agent?.last_name || ''}`.trim() || 'un agent';
      const date = event.date ? new Date(event.date).toLocaleDateString('fr-FR') : 'N/A';
      showToast(`📅 Nouveau RDV par ${agentName} le ${date}`, 'info');
      // Refetch data that might have changed
      fetchAppointments(appointmentFetchPage, appointmentFetchRowsPerPage);
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats if viewing
    };
    supervisorChannel.listen('.appointment.created', handleAppointmentCreated);

    // Handler for clinic quote uploads relevant to supervisors
    const handleClinicQuoteUploaded = (event) => {
      console.log('Pusher: clinic.quote.uploaded received (Supervisor)', event); // Dev log
      const clinicName = event.clinique?.name || 'une clinique';
      const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'un patient';
      showToast(`📄 Devis téléchargé par ${clinicName} pour ${patientName}`, 'info');
      // Appointment data likely contains the quote URL, so refetch
      fetchAppointments(appointmentFetchPage, appointmentFetchRowsPerPage);
      // Optionally refresh stats if relevant
      // if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear);
    };
    supervisorChannel.listen('.clinic.quote.uploaded', handleClinicQuoteUploaded);

    // Handler for when a supervisor (or admin acting on behalf) sends a quote
    const handleQuoteSentToPatient = (event) => {
        console.log('Pusher: quote.sent.to.patient received (Supervisor)', event); // Dev log
        const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'un patient';
        // Determine who sent it if possible from event data (e.g., event.sender_role)
        const sender = 'Le système'; // Default or derive from event data
        showToast(`📨 ${sender} a envoyé un devis au patient ${patientName}`, 'info');
        // Refetch quotes as the status/sent_at field has changed
        fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
        // Optionally refresh stats
         if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear);
    };
    supervisorChannel.listen('.quote.sent.to.patient', handleQuoteSentToPatient);


    // Handler for appointment status updates
const handleAppointmentStatusUpdated = (event) => {
  const status = event.status || 'mis à jour';
  const patientName = `${event.patient?.name || ''} ${event.patient?.last_name || ''}`.trim() || 'le patient';
  showToast(`📌 Statut du RDV pour ${patientName} mis à jour: ${status}`, 'info');
  fetchAppointments(appointmentFetchPage, appointmentFetchRowsPerPage);
  if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear);
};
supervisorChannel.listen('.appointment.status.updated', handleAppointmentStatusUpdated);


    // Cleanup: Stop listening when component unmounts or role changes
    return () => {
      console.log('Stopping Pusher listeners (Supervisor)'); // Dev log
      supervisorChannel.stopListening('.appointment.created', handleAppointmentCreated);
      supervisorChannel.stopListening('.clinic.quote.uploaded', handleClinicQuoteUploaded);
      supervisorChannel.stopListening('.quote.sent.to.patient', handleQuoteSentToPatient);
      supervisorChannel.stopListening('.appointment.status.updated', handleAppointmentStatusUpdated);

      // Consider leaving the channel if appropriate, e.g., window.Echo.leave('role.superviseur');
    };
    // Ensure dependencies cover all state/functions used inside
  }, [userRole, fetchAppointments, fetchQuotes, fetchStatistics, showToast, activeSection, statsMonth, statsYear, appointmentFetchPage, appointmentFetchRowsPerPage, quotePage, quoteRowsPerPage, debouncedQuoteSearch]);


  // Effect for fetching statistics when filters change
  useEffect(() => {
    if (userRole === 'superviseur' && !loading.auth && isMountedRef.current) {
      fetchStatistics(statsMonth, statsYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsMonth, statsYear, granularity, comparePrevious, userRole, loading.auth, fetchStatistics]); // Add fetchStatistics dependency

  // Auto Refresh Logic for Statistics
  useEffect(() => {
    let intervalId = null;
    if (autoRefresh && isMountedRef.current && activeSection === 'statistics' && userRole === 'superviseur') {
      intervalId = setInterval(() => {
        showToast('🔄 Rafraîchissement automatique des statistiques...', 'info', 2000);
        fetchStatistics(statsMonth, statsYear);
      }, 60000); // Refresh every 60 seconds
      console.log('Auto-refresh interval started (Supervisor)'); // Dev log
    }
    // Cleanup interval on unmount or when conditions change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('Auto-refresh interval cleared (Supervisor)'); // Dev log
      }
    };
  }, [autoRefresh, activeSection, userRole, statsMonth, statsYear, fetchStatistics, showToast]);

  // --- CRUD Handlers ---
  const handleSaveUser = async () => {
    const isEditing = !!currentUser;
    // Use currentUser if editing, newUser if creating
    const userDataToSave = isEditing ? { ...currentUser, password: currentUser.password || undefined } : { ...newUser };

    // Basic Validation
    if (!userDataToSave.name || !userDataToSave.last_name || !userDataToSave.email || !userDataToSave.role) {
      setError(prev => ({ ...prev, dialog: "Veuillez remplir tous les champs obligatoires (Prénom, Nom, Email, Rôle)." }));
      showToast("Veuillez remplir tous les champs obligatoires.", 'error'); return;
    }
    if (!isEditing && !userDataToSave.password) {
      setError(prev => ({ ...prev, dialog: "Le mot de passe est requis pour les nouveaux utilisateurs." }));
      showToast("Le mot de passe est requis pour les nouveaux utilisateurs.", 'error'); return;
    }
    if (userDataToSave.password && userDataToSave.password.length < 8) {
      setError(prev => ({ ...prev, dialog: "Le mot de passe doit comporter au moins 8 caractères." }));
      showToast("Le mot de passe doit comporter au moins 8 caractères.", 'error'); return;
    }

    setError(prev => ({ ...prev, dialog: null })); // Clear previous dialog errors

    // *** USE SUPERVISOR ENDPOINT ***
    const url = isEditing ? `/superviseur/users/${currentUser.id}` : '/superviseur/users';
    const method = isEditing ? 'put' : 'post';

    try {
      const response = await apiClient[method](url, userDataToSave, { headers: { 'Content-Type': 'application/json' } });
      closeUserDialog(); // Close dialog on success
      // Refetch users list to show changes
      fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
      const actionText = isEditing ? 'mis à jour' : 'créé';
      showToast(`L'utilisateur "${response.data.name || userDataToSave.name}" a été ${actionText} avec succès.`, 'success');
    } catch (err) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} user (Supervisor):`, err.response?.data); // Dev Log
      const errors = err.response?.data?.errors;
      let errorMsg = `Échec de la ${isEditing ? 'mise à jour' : 'création'} de l'utilisateur.`;
      if (errors) {
        // Concatenate validation errors
        errorMsg += " " + Object.values(errors).flat().join(' ');
      } else {
        // Use server message or a generic one
        errorMsg += " " + (err.response?.data?.message || 'Veuillez vérifier les détails et réessayer.');
      }
      setError(prev => ({ ...prev, dialog: errorMsg })); // Show error in the dialog
      showToast(errorMsg, 'error'); // Also show a toast notification
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    // Find the user to get their current status if not passed directly
    // const user = users.find(u => u.id === userId);
    // if (!user) return;
    openConfirmationModal({
        title: `${currentStatus ? 'Désactiver' : 'Activer'} Utilisateur`,
        message: `Êtes-vous sûr de vouloir ${currentStatus ? 'désactiver' : 'activer'} ce compte utilisateur ?`,
        confirmText: currentStatus ? 'Désactiver' : 'Activer',
        onConfirm: async () => {
            try {
                // *** USE SUPERVISOR ENDPOINT ***
                const response = await apiClient.post(`/superviseur/users/${userId}/toggle-status`);
                const isActive = response.data?.is_active; // Assuming API returns the new status
                showToast(`Compte utilisateur ${isActive ? 'activé' : 'désactivé'}.`, 'success');
                // Refetch users to update the list
                fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
                closeConfirmationModal(); // Close modal on success
            } catch (err) {
                console.error("Failed to toggle user status (Supervisor):", err); // Dev Log
                showToast("Échec de la modification du statut de l'utilisateur. " + (err.response?.data?.message || ''), 'error');
                // Keep modal open on error, loading state is handled by handleModalConfirm
                setModalLoading(false); // Ensure loading is reset
            }
        }
    });
  };

  const viewPatientFiles = async (userId) => {
    try {
      // *** USE SUPERVISOR ENDPOINT ***
      const responseFiles = await apiClient.get(`/superviseur/users/${userId}/patient-files`);
      const files = responseFiles.data;

      if (!files || files.length === 0) {
        showToast('Ce patient n\'a ajouté aucun fichier.', 'info');
        return;
      }

      // For simplicity, download the first file found. Modify if multiple files need handling.
      const firstFile = files[0];
      const fileId = firstFile.id;
      const fileName = firstFile.file_name || `dossier_medical_${userId}_${fileId}.pdf`; // Construct a filename
      const token = localStorage.getItem('token');

      // *** USE SUPERVISOR ENDPOINT ***
      const downloadUrlApi = `${apiClient.defaults.baseURL}/superviseur/files/${fileId}/download`;

      // Use fetch for blob download to handle headers easily
      const responseBlob = await fetch(downloadUrlApi, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf', // Request PDF content type
        }
      });

      if (!responseBlob.ok) {
        // Try to get error details from the response body
        let errorText = 'Erreur inconnue';
        try {
          const errorData = await responseBlob.json(); // Try parsing JSON error
          errorText = errorData.message || JSON.stringify(errorData);
        } catch (e) {
          errorText = await responseBlob.text(); // Fallback to text error
        }
        throw new Error(`Échec du téléchargement avec le statut ${responseBlob.status}. ${errorText}`);
      }

      const blob = await responseBlob.blob(); // Get the file blob

      // Create a temporary link to trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = fileName; // Set the desired filename
      document.body.appendChild(a);
      a.click(); // Simulate click to trigger download
      document.body.removeChild(a); // Clean up the link
      window.URL.revokeObjectURL(downloadUrl); // Release the object URL

    } catch (err) {
      console.error("Failed to fetch or download patient files (Supervisor):", err); // Dev Log
      showToast("Échec du téléchargement du fichier patient. " + (err.message || ''), 'error');
    }
  };

  // Function to open clinic quote URL (likely stored on appointment)
  const viewClinicQuote = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer'); // Open in new tab securely
    } else {
      showToast('Aucun lien de devis clinique disponible.', 'info');
    }
  };

  // Function to handle creating or updating a supervisor-generated quote
  const handleCreateOrUpdateQuote = async () => {
    const { appointment_id, assistance_items, total_clinique } = newQuote;

    // Validation
    if (!appointment_id) {
      setError(prev => ({ ...prev, dialog: "Veuillez sélectionner un rendez-vous." }));
      showToast("Veuillez sélectionner un rendez-vous.", 'error'); return;
    }
    if (!total_clinique || isNaN(parseFloat(total_clinique))) {
      setError(prev => ({ ...prev, dialog: "Veuillez saisir un total clinique valide." }));
      showToast("Veuillez saisir un total clinique valide.", 'error'); return;
    }
    if (!assistance_items || assistance_items.length === 0 || assistance_items.some(item => !item.label || !item.amount || isNaN(parseFloat(item.amount)))) {
      setError(prev => ({ ...prev, dialog: "Veuillez compléter tous les éléments d'assistance avec des libellés et des montants valides." }));
      showToast("Veuillez compléter tous les éléments d'assistance.", 'error'); return;
    }

    setError(prev => ({ ...prev, dialog: null })); // Clear dialog error

    // Prepare data payload
    const quoteData = {
      appointment_id: Number(appointment_id), // Ensure ID is a number
      total_clinique: parseFloat(total_clinique),
      assistance_items: assistance_items.map(item => ({
        label: item.label,
        amount: parseFloat(item.amount) // Ensure amount is a number
      })),
    };

    // Determine endpoint and method (create vs update)
    // *** USE SUPERVISOR ENDPOINT ***
    const endpoint = currentQuoteId ? `/superviseur/quotes/${currentQuoteId}` : '/superviseur/quotes';
    const method = currentQuoteId ? 'put' : 'post';
    const actionText = currentQuoteId ? 'mis à jour' : 'créé';

    try {
      await apiClient[method](endpoint, quoteData);
      showToast(`Devis ${actionText} avec succès ! Le PDF sera généré/mis à jour par le système.`, 'success');
      closeQuoteDialog(); // Close dialog on success
      // Refetch relevant data
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
      fetchAppointments(appointmentFetchPage, appointmentFetchRowsPerPage); // Appointments might be linked
      if (activeSection === 'statistics') fetchStatistics(statsMonth, statsYear); // Refresh stats if viewing

    } catch (err) {
      console.error(`Failed to ${actionText} quote (Supervisor):`, err.response?.data || err.message); // Dev Log
      let msg = `Échec de la ${currentQuoteId ? 'mise à jour' : 'création'} du devis.`;
      if (err.response?.data?.message) {
        msg += ` ${err.response.data.message}`;
      } else if (err.response?.data?.errors) {
        // Concatenate validation errors
        msg += ' ' + Object.values(err.response.data.errors).flat().join(' ');
      } else {
        msg += ' Une erreur inattendue s\'est produite.';
      }
      setError(prev => ({ ...prev, dialog: msg })); // Show error in dialog
      showToast(msg, 'error'); // Show toast error
    }
  };


  // Handler for supervisor logout action
  const handleSupervisorLogout = () => {
    logout(); // Call the logout function from the useAuth hook
  };

  // --- Dialog Management ---
  const openUserDialog = (user = null) => {
    setError(prev => ({ ...prev, dialog: null })); // Clear dialog errors
    if (user) {
      // Editing existing user
      const roleName = user.roles?.length > 0 ? user.roles[0].name : (user.role || ''); // Get role name
      setCurrentUser({
        ...user,
        password: '', // Clear password field for editing
        role: roleName,
        telephone: user.telephone || '', // Populate optional fields
        adresse: user.adresse || ''
      });
      setNewUser({ name: '', last_name: '', email: '', password: '', role: '', telephone: '', adresse: '' }); // Clear newUser form
    } else {
      // Adding new user
      setNewUser({ name: '', last_name: '', email: '', password: '', role: '', telephone: '', adresse: '' }); // Reset newUser form
      setCurrentUser(null); // Ensure no currentUser is set
    }
    setIsUserDialogOpen(true); // Open the dialog
  };

  const closeUserDialog = () => {
    setIsUserDialogOpen(false);
    // Reset state after dialog closes
    setCurrentUser(null);
    setNewUser({ name: '', last_name: '', email: '', password: '', role: '', telephone: '', adresse: '' });
    setError(prev => ({ ...prev, dialog: null })); // Clear dialog errors
  };

  const openQuoteDialog = (quoteToModify = null) => {
    setError(prev => ({ ...prev, dialog: null })); // Clear dialog errors

    // Determine which appointments are available for selection
    // Exclude appointments already having a supervisor quote (unless editing that specific quote)
    const supervisorQuoteIds = new Set(
      quotes
        .filter(q => !q.is_clinic && q.appointment_id !== null && q.id !== quoteToModify?.id) // Filter supervisor quotes, exclude self if editing
        .map(q => q.appointment_id)
    );

    // Filter available appointments
    const available = appointments.filter(appt =>
        !supervisorQuoteIds.has(appt.id) || // Not already quoted by supervisor
        (quoteToModify && appt.id === quoteToModify.appointment_id) // Or is the appointment of the quote being edited
    );
    setAvailableAppointments(available);

    if (quoteToModify) {
      // Editing existing quote
      setCurrentQuoteId(quoteToModify.id);
      setNewQuote({
        // Ensure appointment_id is correctly sourced (might be directly on quote or nested)
        appointment_id: quoteToModify.appointment_id || quoteToModify.appointment?.id || '',
        total_clinique: quoteToModify.total_clinique || '',
        // Map assistance items, provide default if none exist
        assistance_items: quoteToModify.assistance_quotes?.map(aq => ({ label: aq.label, amount: aq.amount })) || [{ label: '', amount: '' }],
      });
    } else {
      // Adding new quote
      setCurrentQuoteId(null);
      // Reset quote form state
      setNewQuote({ appointment_id: '', total_clinique: '', assistance_items: [{ label: '', amount: '' }] });
    }
    setIsQuoteDialogOpen(true); // Open the dialog
  };

  const closeQuoteDialog = () => {
    setIsQuoteDialogOpen(false);
    // Reset state after dialog closes
    setCurrentQuoteId(null);
    setNewQuote({ appointment_id: '', total_clinique: '', assistance_items: [{ label: '', amount: '' }] });
    setError(prev => ({ ...prev, dialog: null })); // Clear dialog errors
    setAvailableAppointments([]); // Clear available appointments list
  };

  // --- Table Pagination Handlers ---
  const handleChangeUserPage = (newPage) => {
    // Fetch data for the new page
    fetchUsers(newPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
  };
  const handleChangeUserRowsPerPage = (newLimit) => {
    // Fetch data with the new limit, resetting to page 0
    fetchUsers(0, newLimit, debouncedUserSearch, selectedRoleFilter);
  };

  // Client-side pagination handlers for the Appointments View Table
  const handleChangeAppointmentViewPage = (newPage) => {
    setAppointmentViewPage(newPage);
  };
  const handleChangeAppointmentViewRowsPerPage = (newLimit) => {
    setAppointmentViewRowsPerPage(newLimit);
    setAppointmentViewPage(0); // Reset to first page when rows per page changes
  };

  // Server-side pagination handlers for Quotes Table
  const handleChangeQuotePage = (newPage) => {
    // Fetch data for the new quote page
    fetchQuotes(newPage, quoteRowsPerPage, debouncedQuoteSearch);
  };
  const handleChangeQuoteRowsPerPage = (newLimit) => {
    // Fetch data with new limit, reset to page 0
    fetchQuotes(0, newLimit, debouncedQuoteSearch);
  };


  // --- Memoized Data for Tables & Charts ---

  // Filter appointments for the display table based on selected filters
  const filteredAppointmentsForTable = useMemo(() => {
    return appointments.filter(appt => {
      const statusMatch = !appointmentStatusFilter || appt.status?.toLowerCase() === appointmentStatusFilter.toLowerCase();
      const serviceMatch = !appointmentServiceFilter || appt.service?.toLowerCase() === appointmentServiceFilter.toLowerCase();
      return statusMatch && serviceMatch;
    });
  }, [appointments, appointmentStatusFilter, appointmentServiceFilter]);

  // Paginate the filtered appointments for the display table
  const paginatedAppointmentsForTable = useMemo(() => {
    const start = appointmentViewPage * appointmentViewRowsPerPage;
    const end = start + appointmentViewRowsPerPage;
    return filteredAppointmentsForTable.slice(start, end);
  }, [filteredAppointmentsForTable, appointmentViewPage, appointmentViewRowsPerPage]);

  // Filter quotes for the display table based on selected filters
  const filteredQuotesForTable = useMemo(() => {
    // Filter only supervisor quotes (assuming !is_clinic indicates supervisor quote)
    return quotes.filter(q => {
        const isSupervisorQuote = !q.is_clinic; // Adjust this condition based on your data model
        const statusMatch = !quoteStatusFilter || q.status?.toLowerCase() === quoteStatusFilter.toLowerCase();
        // Match service based on the linked appointment
        const serviceMatch = !quoteServiceFilter || q.appointment?.service?.toLowerCase() === quoteServiceFilter.toLowerCase();
        return isSupervisorQuote && statusMatch && serviceMatch;
    });
}, [quotes, quoteStatusFilter, quoteServiceFilter]);

  // Note: Quotes pagination is handled server-side by fetchQuotes,
  // so we directly use the `quotes` state which holds the current page's data.
  // No client-side pagination needed here if fetchQuotes implements server pagination.

  // Prepare data for the statistics chart
  const chartData = useMemo(() => {
    if (!statistics || !Array.isArray(statistics.labels) || !Array.isArray(statistics.datasets)) {
      return []; // Return empty array if data is invalid
    }
    // Filter out potentially invalid datasets
    const validDatasets = statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data));
    // If no valid datasets but labels exist, return labels for axis rendering
    if (validDatasets.length === 0 && statistics.labels.length > 0) {
      return statistics.labels.map(label => ({ day: label })); // Use 'day' or whatever XAxis dataKey is
    }
    // Map labels and datasets to the format required by Recharts
    return statistics.labels.map((label, index) => {
      const dataPoint = { day: label }; // Key matches XAxis dataKey
      validDatasets.forEach(dataset => {
        // Assign data, defaulting to 0 if missing for this index
        dataPoint[dataset.label] = dataset.data[index] ?? 0;
      });
      return dataPoint;
    });
  }, [statistics]); // Dependency: recalculate when statistics data changes

  // Get unique appointment statuses for the filter dropdown
  const appointmentStatusesForFilter = useMemo(() => {
    const statuses = new Set(appointments.map(appt => appt.status).filter(Boolean));
    return Array.from(statuses).sort(); // Sort alphabetically
  }, [appointments]);

  // Get unique appointment services for the filter dropdown
  const appointmentServicesForFilter = useMemo(() => {
    const services = new Set(appointments.map(appt => appt.service).filter(Boolean));
    return Array.from(services).sort();
  }, [appointments]);

  // Get unique quote statuses for the filter dropdown
  const quoteStatusesForFilter = useMemo(() => {
      // Filter for supervisor quotes first if needed, then get statuses
      const statuses = new Set(quotes.filter(q => !q.is_clinic).map(q => q.status).filter(Boolean));
      return Array.from(statuses).sort();
  }, [quotes]);

  // Get unique quote services (from associated appointments) for the filter dropdown
  const quoteServicesForFilter = useMemo(() => {
      const services = new Set(quotes.filter(q => !q.is_clinic && q.appointment?.service).map(q => q.appointment.service));
      return Array.from(services).sort();
  }, [quotes]);


  // --- UI Navigation & State Changes ---
  const setSection = (section) => {
    setActiveSection(section);
    // Close sidebar on mobile when a section is selected
    if (window.innerWidth < 992) { // Adjust breakpoint as needed
      setSidebarOpen(false);
    }
  };

  // Handlers for appointment filter changes
  const handleAppointmentStatusFilterChange = (e) => {
    setAppointmentStatusFilter(e.target.value);
    setAppointmentViewPage(0); // Reset page when filter changes
  };
  const handleAppointmentServiceFilterChange = (e) => {
    setAppointmentServiceFilter(e.target.value);
    setAppointmentViewPage(0); // Reset page when filter changes
  };

  // Handlers for quote filter changes
  const handleQuoteStatusFilterChange = (e) => {
      setQuoteStatusFilter(e.target.value);
      // Note: Quote pagination is server-side, so changing filters
      // might require a refetch depending on implementation.
      // For now, assume filtering applies to the currently fetched page.
      // If filters should trigger refetch: fetchQuotes(0, quoteRowsPerPage, debouncedQuoteSearch);
  };
  const handleQuoteServiceFilterChange = (e) => {
      setQuoteServiceFilter(e.target.value);
      // See note above about refetching.
  };

  // --- Export Logic ---
  const handleExportAsImage = async () => {
    const element = chartContainerRef.current;
    if (!element || typeof html2canvas === 'undefined') {
      showToast('Fonctionnalité d\'exportation non prête ou élément non trouvé.', 'error');
      console.error('html2canvas is not loaded or chart element not found.');
      return;
    }
    try {
      const canvas = await html2canvas(element, {
          useCORS: true, // Important for external resources if any
          allowTaint: true, // May be needed depending on content
          backgroundColor: '#ffffff' // Set background color for transparency issues
      });
      const link = document.createElement('a');
      link.download = `statistiques_superviseur_${statsYear}_${statsMonth}.png`; // Filename
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Graphique exporté en PNG.', 'success');
    } catch (error) {
      console.error('Error exporting chart as image:', error);
      showToast('Erreur lors de l\'exportation en PNG.', 'error');
    }
  };

  const handleExportAsPDF = async () => {
    const element = chartContainerRef.current;
    if (!element || typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
      showToast('Fonctionnalité d\'exportation non prête ou élément non trouvé.', 'error');
      console.error('html2canvas or jsPDF is not loaded or chart element not found.');
      return;
    }
    try {
      const canvas = await html2canvas(element, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
          orientation: 'landscape', // 'portrait' or 'landscape'
          unit: 'px', // Use pixels for direct mapping
          // Calculate format based on canvas dimensions, maybe add padding
          format: [canvas.width + 40, canvas.height + 40] // Add some padding
      });
      // Add image centered or at top-left with padding
      pdf.addImage(imgData, 'PNG', 20, 20, canvas.width, canvas.height);
      pdf.save(`statistiques_superviseur_${statsYear}_${statsMonth}.pdf`); // Filename
      showToast('Graphique exporté en PDF.', 'success');
    } catch (error) {
      console.error('Error exporting chart as PDF:', error);
      showToast('Erreur lors de l\'exportation en PDF.', 'error');
    }
  };


  // --- Render Logic ---

  // Loading state during initial authentication check
  if (loading.auth) {
    return (
      <div className="loading-container dashboard-body">
        <div className="simple-spinner"></div>
        <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Vérification de l'authentification (Superviseur)...</p>
      </div>
    );
  }

  // If authentication failed or user is not a supervisor
  if (!userRole && !loading.auth) {
    return (
      <div className="error-container dashboard-body">
        <p>{error.general || 'Accès refusé : Rôle superviseur requis.'}</p>
        <button onClick={() => navigate('/login')} className="action-button">Aller à la connexion</button>
      </div>
    );
  }

  // Main dashboard rendering
  return (
    <>
      {/* Toast Notifications */}
      {isToastVisible && (<ToastNotification message={toastMessage} type={toastType} />)}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleModalConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText || 'Confirmer'}
        cancelText={modalConfig.cancelText || 'Annuler'}
        isLoading={modalLoading}
      />

      {/* Main Dashboard Layout */}
      <div className="dashboard-body">
        {/* Header */}
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Basculer le menu">
            {/* Menu Icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div className="header-title">Tableau de Bord Superviseur</div>
          <div className="header-actions">
            <button onClick={handleSupervisorLogout}>Déconnexion</button>
          </div>
        </header>

        {/* Content Wrapper (Sidebar + Main Area) */}
        <div className="main-content-wrapper">
          {/* Sidebar */}
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            {/* Sidebar Navigation Buttons */}
            <button className={`sidebar-button ${activeSection === 'statistics' ? 'active' : ''}`} onClick={() => setSection('statistics')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg> Statistiques
            </button>
            <button className={`sidebar-button ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setSection('users')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> Utilisateurs
            </button>
            <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setSection('appointments')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Rendez-vous
            </button>
            <button className={`sidebar-button ${activeSection === 'quotes' ? 'active' : ''}`} onClick={() => setSection('quotes')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> Devis
            </button>
          </aside>

          {/* Main Content Area */}
          <main className="content-area">
            {/* Overlay for closing sidebar on mobile */}
            <div className="content-overlay" onClick={() => setSidebarOpen(false)}></div>

            {/* General Error Display */}
            {error.general && !isUserDialogOpen && !isQuoteDialogOpen && !isModalOpen && (
              <div className="alert-message alert-message-error">
                <span>{error.general}</span>
                <button className="alert-close-btn" onClick={() => setError(prev => ({ ...prev, general: null }))}>×</button>
              </div>
            )}

            {/* --- Statistics Section --- */}
            {activeSection === 'statistics' && (
              <section className="content-section">
                <div className="section-header"><h3>Statistiques de la Plateforme (Superviseur)</h3></div>

                {/* Summary Cards */}
                 <div className="summary-cards">
                  <div className="summary-card">📅 Total RDVs: {loading.stats ? '...' : summaryStats.totalRdv}</div>
                  <div className="summary-card">📄 Devis Envoyés: {loading.stats ? '...' : summaryStats.totalQuotes}</div>
                  <div className="summary-card">✅ Taux Acceptation: {loading.stats ? '...' : `${summaryStats.acceptedRate.toFixed(1)}%`}</div>
                </div>

                {/* Date Filters */}
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="stats-month-sv">Mois</label>
                    <select id="stats-month-sv" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} disabled={loading.stats}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (<option key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('fr-FR', { month: 'long' })}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="stats-year-sv">Année</label>
                    <select id="stats-year-sv" value={statsYear} onChange={(e) => setStatsYear(e.target.value)} disabled={loading.stats}>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (<option key={y} value={String(y)}>{y}</option>))}
                    </select>
                  </div>
                </div>

                {/* Advanced Filters & Export */}
                <div className="filter-controls advanced">
                  <div className="form-group">
                    <label htmlFor="granularity-select-sv" className="sr-only">Granularité</label>
                    <select id="granularity-select-sv" value={granularity} onChange={(e) => setGranularity(e.target.value)} disabled={loading.stats}>
                      <option value="daily">Quotidien</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuel</option>
                    </select>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={comparePrevious} onChange={(e) => setComparePrevious(e.target.checked)} disabled={loading.stats} />
                    📊 Comparer Période Préc.
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                    🔄 Rafraîch. Auto (60s)
                  </label>
                  <button onClick={handleExportAsImage} disabled={loading.stats || !statistics} className="action-button button-small button-outline">📷 Exporter Image</button>
                  <button onClick={handleExportAsPDF} disabled={loading.stats || !statistics} className="action-button button-small button-outline">📄 Exporter PDF</button>
                  {loading.stats && <div className="simple-spinner" style={{ width: '24px', height: '24px', marginLeft: '10px' }}></div>}
                </div>

                {/* Chart Area */}
                <div className="chart-container" ref={chartContainerRef} style={{ height: '400px', width: '100%', position: 'relative' }}>
                  {loading.stats && (<div className="chart-loading-overlay"><div className="simple-spinner"></div></div>)}
                  {!loading.stats && statistics && chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                          <XAxis dataKey="day" stroke="var(--text-light, #64748b)" fontSize={12} />
                          <YAxis allowDecimals={false} stroke="var(--text-light, #64748b)" fontSize={12} />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(194, 155, 110, 0.1)' }}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                          {/* Render Bars and Lines based on dataset */}
                          {statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data)).map((dataset, idx) => {
                            const isComparison = dataset.label.toLowerCase().includes('précédente') || dataset.label.toLowerCase().includes('previous');
                            return isComparison ? (
                              <Line // Render comparison data as a Line
                                key={`${dataset.label}-line-${idx}`}
                                type="monotone"
                                dataKey={dataset.label}
                                stroke="#8884d8" // Distinct color for comparison line
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                strokeDasharray="5 5" // Dashed line for comparison
                                name={dataset.label} // Name for Legend/Tooltip
                              />
                            ) : (
                              <Bar // Render primary data as Bars
                                key={`${dataset.label}-bar-${idx}`}
                                dataKey={dataset.label}
                                fill={chartColors[idx % chartColors.length]} // Cycle through colors
                                radius={[4, 4, 0, 0]} // Rounded top corners
                                name={dataset.label} // Name for Legend/Tooltip
                              />
                            );
                          })}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : !loading.stats && error.stats ? (
                      <div className="alert-message alert-message-warning" style={{ margin: 'auto', maxWidth: '400px', textAlign: 'center' }}>
                        <span>{error.stats}</span>
                      </div>
                    ) : !loading.stats && (!statistics || chartData.length === 0) ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-light, #64748b)', marginTop: '60px', fontSize: '1.1em' }}>
                        Aucune donnée statistique disponible pour la période sélectionnée.
                      </p>
                    ): null /* Covers the case where loading is false but statistics is null initially */ }
                </div>
              </section>
            )}

            {/* --- Users Section --- */}
            {activeSection === 'users' && (
              <section className="content-section">
                <div className="section-header">
                  <h3>Gestion des Utilisateurs (Superviseur)</h3>
                  {/* Add User Button - Check permissions if supervisor can add users */}
                  <button className="action-button button-small" onClick={() => openUserDialog()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Ajouter Utilisateur
                  </button>
                </div>

                {/* User Filters */}
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="user-search-sv" className="sr-only">Rechercher Utilisateurs</label>
                    <input id="user-search-sv" type="text" placeholder="Rechercher (Nom, Email)" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} disabled={loading.users} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="role-filter-sv" className="sr-only">Filtrer par Rôle</label>
                    <select id="role-filter-sv" value={selectedRoleFilter} onChange={(e) => setSelectedRoleFilter(e.target.value)} disabled={loading.users}>
                      <option value="">Tous les Rôles Gérés</option>
                      {/* Show only roles the supervisor can manage */}
                      {manageableRoles.map(role => (<option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>))}
                    </select>
                  </div>
                  {loading.users && <div className="simple-spinner" style={{ width: '24px', height: '24px' }}></div>}
                </div>

                {/* User Error Display */}
                {error.users && <div className="alert-message alert-message-warning"><span>{error.users}</span></div>}

                {/* Users Table */}
                <div className="table-container responsive">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Adresse</th>
                        <th>Rôle(s)</th>
                        <th>Statut</th>
                        <th className="actions-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.users ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : users.length > 0 ? users.map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.name} {user.last_name}</strong></td>
                          <td>{user.email}</td>
                          <td>{user.telephone || '-'}</td>
                          <td>{user.adresse || '-'}</td>
                          <td>{user.roles?.map(r => r.name).join(', ') || user.role || 'N/D'}</td>
                          <td>
                            <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                              {user.is_active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="actions-cell">
                            {/* Edit User */}
                            <button className="action-button button-small button-icon-only button-outline" onClick={() => openUserDialog(user)} title="Modifier Utilisateur" aria-label="Modifier utilisateur">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                            </button>
                            {/* Toggle Status */}
                            <button className={`action-button button-small ${user.is_active ? 'button-warning' : 'button-success'}`} onClick={() => toggleUserStatus(user.id, user.is_active)} title={user.is_active ? 'Désactiver' : 'Activer'} style={{ minWidth: '95px' }}>
                              {user.is_active ? 'Désactiver' : 'Activer'}
                            </button>
                            {/* View Patient Files (if user is patient) */}
                            {user.roles?.some(r => r.name === 'patient') && (
                              <button className="action-button button-small button-outline" onClick={() => viewPatientFiles(user.id)} title="Voir Fichiers Patient" style={{ minWidth: '90px' }}>
                                Voir PDFs
                              </button>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr className="no-results-row"><td colSpan="7">Aucun utilisateur trouvé correspondant aux critères.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* User Pagination */}
                <CustomPagination
                    count={userTotalRows}
                    rowsPerPage={userRowsPerPage}
                    page={userPage}
                    onPageChange={handleChangeUserPage}
                    onRowsPerPageChange={handleChangeUserRowsPerPage}
                    rowsPerPageOptions={userRowsPerPageOptions}
                />
              </section>
            )}

            {/* --- Appointments Section --- */}
            {activeSection === 'appointments' && (
              <section className="content-section">
                <div className="section-header"><h3>Aperçu des Rendez-vous</h3></div>

                {/* Appointment Filters */}
                <div className="filter-controls">
                    <div className="form-group">
                        <label htmlFor="appointment-status-filter-sv" className="sr-only">Filtrer par Statut</label>
                        <select
                            id="appointment-status-filter-sv"
                            value={appointmentStatusFilter}
                            onChange={handleAppointmentStatusFilterChange}
                            disabled={loading.appointments}
                        >
                            <option value="">Tous les Statuts</option>
                            {appointmentStatusesForFilter.map(status => (
                                <option key={status} value={status.toLowerCase()}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="appointment-service-filter-sv" className="sr-only">Filtrer par Service</label>
                        <select
                            id="appointment-service-filter-sv"
                            value={appointmentServiceFilter}
                            onChange={handleAppointmentServiceFilterChange}
                            disabled={loading.appointments}
                        >
                            <option value="">Tous les Services</option>
                            {appointmentServicesForFilter.map(service => (
                                <option key={service} value={service.toLowerCase()}>
                                    {service.charAt(0).toUpperCase() + service.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                    {loading.appointments && <div className="simple-spinner" style={{ width: '24px', height: '24px', marginLeft: '10px' }}></div>}
                </div>

                {/* Appointment Error Display */}
                {error.appointments && <div className="alert-message alert-message-warning"><span>{error.appointments}</span></div>}

                {/* Appointments Table */}
                <div className="table-container responsive">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        {/* Adjust columns based on what a supervisor needs to see */}
                        <th>Prospect</th>
                        <th>Date RDV</th>
                        <th>Service</th>
                        <th>Agent</th>
                        <th>Statut</th>
                        <th>Devis Clinique</th>
                        {/* Add other relevant columns: Type Soins, Qualification, etc. */}
                      </tr>
                    </thead>
                    <tbody>
                      {loading.appointments && !paginatedAppointmentsForTable.length ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : paginatedAppointmentsForTable.length > 0 ? (
                        paginatedAppointmentsForTable.map(appt => (
                          <tr key={appt.id}>
                            <td><strong>{appt.prenom_du_prospect} {appt.nom_du_prospect}</strong><br/><small>{appt.telephone || ''}</small></td>
                            <td>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleString('fr-TN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                            <td>{appt.service || '-'}</td>
                            <td>{appt.agent ? `${appt.agent.name} ${appt.agent.last_name}` : '-'}</td>
                            <td>
                              <span className={`status-badge ${appt.status?.toLowerCase().replace(/\s+/g, '-') || 'default'}`}>
                                {appt.status || 'N/D'}
                              </span>
                            </td>
                            <td>
                              {appt.clinic_quote_url ? (
                                <a href={appt.clinic_quote_url} target="_blank" rel="noopener noreferrer" className="quote-link-icon" title="Voir Devis Clinique">
                                  📄 Voir
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="no-results-row"><td colSpan="6">Aucun rendez-vous trouvé correspondant à vos critères.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Appointment Pagination (Client-side for display) */}
                <CustomPagination
                  count={filteredAppointmentsForTable.length} // Count based on filtered data
                  rowsPerPage={appointmentViewRowsPerPage}
                  page={appointmentViewPage}
                  onPageChange={handleChangeAppointmentViewPage}
                  onRowsPerPageChange={handleChangeAppointmentViewRowsPerPage}
                  rowsPerPageOptions={appointmentViewRowsPerPageOptions}
                />
              </section>
            )}

            {/* --- Quotes Section --- */}
            {activeSection === 'quotes' && (
              <section className="content-section">
                <div className="section-header">
                  <h3>Devis Générés (Superviseur)</h3>
                  {/* Add Quote Button */}
                  <button className="action-button button-small" onClick={() => openQuoteDialog()}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Ajouter Devis
                  </button>
                </div>

                {/* Quote Filters */}
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="quote-search-sv" className="sr-only">Rechercher Devis</label>
                    <input id="quote-search-sv" type="text" placeholder="Rechercher (Prospect, ID)" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} disabled={loading.quotes} />
                  </div>
                   <div className="form-group">
                        <label htmlFor="quote-status-filter-sv" className="sr-only">Filtrer par Statut</label>
                        <select
                            id="quote-status-filter-sv"
                            value={quoteStatusFilter}
                            onChange={handleQuoteStatusFilterChange} // Use specific handler
                            disabled={loading.quotes}
                        >
                            <option value="">Tous les Statuts</option>
                            {quoteStatusesForFilter.map(status => ( // Use quote statuses
                                <option key={status} value={status.toLowerCase()}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="quote-service-filter-sv" className="sr-only">Filtrer par Service</label>
                        <select
                            id="quote-service-filter-sv"
                            value={quoteServiceFilter}
                            onChange={handleQuoteServiceFilterChange} // Use specific handler
                            disabled={loading.quotes}
                        >
                            <option value="">Tous les Services</option>
                            {quoteServicesForFilter.map(service => ( // Use quote services
                                <option key={service} value={service.toLowerCase()}>
                                    {service.charAt(0).toUpperCase() + service.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                  {loading.quotes && <div className="simple-spinner" style={{ width: '24px', height: '24px' }}></div>}
                </div>

                {/* Quote Error Display */}
                {error.quotes && <div className="alert-message alert-message-warning"><span>{error.quotes}</span></div>}

                {/* Quotes Table */}
                <div className="table-container responsive">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Prospect (RDV)</th>
                        <th>Date Création</th>
                        <th>Total Clinique</th>
                        <th>Statut</th>
                        <th>Commentaire (si refusé)</th>
                        <th className="actions-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.quotes ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : quotes.filter(q => !q.is_clinic).length > 0 ? ( // Ensure filtering if needed, or rely on server filtering
                          quotes.filter(q => !q.is_clinic) // Filter only supervisor quotes client-side if needed
                          .filter(q => { // Apply client-side filters if server doesn't handle them fully
                              const statusMatch = !quoteStatusFilter || q.status?.toLowerCase() === quoteStatusFilter.toLowerCase();
                              const serviceMatch = !quoteServiceFilter || q.appointment?.service?.toLowerCase() === quoteServiceFilter.toLowerCase();
                              return statusMatch && serviceMatch;
                          })
                          .map(quote => (
                          <tr key={quote.id}>
                            <td>{quote.id}</td>
                            <td>
                              <strong>
                                {quote.appointment ? `${quote.appointment.prenom_du_prospect || ''} ${quote.appointment.nom_du_prospect || ''}` : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>N/A</span>}
                              </strong>
                              <br/>
                              <small>RDV ID: {quote.appointment_id || '-'}</small>
                            </td>
                            <td>{quote.created_at ? new Date(quote.created_at).toLocaleDateString('fr-FR') : '-'}</td>
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
                              {quote.status === 'refused' ? (quote.comment || <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Aucun</span>) : '-'}
                            </td>
                            <td className="actions-cell">
                              {/* Preview PDF */}
                              <button
                                className="action-button button-small button-icon-only button-outline"
                                title="Prévisualiser PDF"
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  // *** USE SUPERVISOR ENDPOINT ***
                                  const previewUrl = `${apiClient.defaults.baseURL}/superviseur/quotes/${quote.id}/preview?token=${token}`;
                                  window.open(previewUrl, '_blank', 'noopener,noreferrer');
                                }}
                              >👁️</button>

                              {/* Edit Quote (if not sent) */}
                              {!quote.sent_to_patient_at && (
                                <button className="action-button button-small button-icon-only button-outline" style={{ marginLeft: '5px' }} onClick={() => openQuoteDialog(quote)} title="Modifier Devis">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                                </button>
                              )}

                              {/* Export & Send (if not sent) */}
                              {!quote.sent_to_patient_at ? (
                                <button className="action-button button-small button-success" style={{ marginLeft: '5px', minWidth: '120px' }}
                                  onClick={() => {
                                    openConfirmationModal({
                                      title: 'Envoyer le Devis au Patient',
                                      message: `Voulez-vous exporter le PDF du devis #${quote.id} et l'envoyer au patient (${quote.appointment?.prenom_du_prospect || ''} ${quote.appointment?.nom_du_prospect || ''}) ?`,
                                      confirmText: 'Oui, Exporter & Envoyer',
                                      onConfirm: async () => {
                                        // Note: handleModalConfirm sets loading state
                                        try {
                                          const token = localStorage.getItem('token');
                                          // 1. Export PDF locally first (optional, but good UX)
                                          // *** USE SUPERVISOR ENDPOINT ***
                                          const pdfUrl = `${apiClient.defaults.baseURL}/superviseur/quotes/${quote.id}/export-pdf`;
                                          const response = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } });
                                          if (!response.ok) throw new Error(`Échec de l'exportation PDF (Code: ${response.status})`);
                                          const blob = await response.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url; a.download = `devis_superviseur_${quote.id}.pdf`;
                                          document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                          window.URL.revokeObjectURL(url);

                                          // 2. Tell backend to mark as sent (and potentially email patient)
                                          // *** USE SUPERVISOR ENDPOINT ***
                                          await apiClient.post(`/superviseur/quotes/${quote.id}/send-to-patient`);

                                          showToast('Devis exporté et marqué comme envoyé au patient !', 'success');
                                          fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch); // Refresh list
                                          closeConfirmationModal(); // Close modal on success
                                        } catch (err) {
                                          console.error("PDF export or send failed (Supervisor):", err); // Dev Log
                                          showToast(`Échec de l'envoi : ${err.message}`, 'error');
                                          // Keep modal open, loading state is handled by handleModalConfirm
                                          setModalLoading(false); // Ensure loading is reset
                                          // throw err; // Re-throw to signal failure to handleModalConfirm
                                        }
                                      }
                                    });
                                  }}
                                >Exporter & Envoyer</button>
                              ) : (
                                <>
                                <span style={{ color: '#666', fontStyle: 'italic', marginLeft:'5px', fontSize:'0.9em' }}>Envoyé</span>
                                {/* Optional: Re-export button */}
                                 <button
                                    className="action-button button-small button-warning button-icon-only"
                                    style={{ marginLeft: '5px' }}
                                    title="Re-télécharger PDF"
                                    onClick={() => {
                                        openConfirmationModal({
                                            title: 'Re-télécharger le Devis ?',
                                            message: 'Ce devis a déjà été envoyé. Voulez-vous le re-télécharger ?',
                                            confirmText: 'Oui, Télécharger',
                                            onConfirm: async () => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    const exportUrl = `${apiClient.defaults.baseURL}/superviseur/quotes/${quote.id}/export-pdf`;
                                                    const response = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
                                                    if (!response.ok) throw new Error('Erreur export PDF');
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url; a.download = `devis_superviseur_${quote.id}_reexport.pdf`;
                                                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                    window.URL.revokeObjectURL(url);
                                                    showToast("PDF re-téléchargé.", "success");
                                                } catch (err) {
                                                    console.error(err);
                                                    showToast("Erreur lors du re-téléchargement.", "error");
                                                } finally {
                                                    closeConfirmationModal();
                                                }
                                            }
                                        });
                                    }}
                                >
                                    ♻️
                                </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="no-results-row"><td colSpan="7">Aucun devis superviseur trouvé.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Quote Pagination (Server-side) */}
                <CustomPagination
                    count={quoteTotalRows} // Use total rows from API
                    rowsPerPage={quoteRowsPerPage}
                    page={quotePage}
                    onPageChange={handleChangeQuotePage} // Fetches new page data
                    onRowsPerPageChange={handleChangeQuoteRowsPerPage} // Fetches new data with limit
                    rowsPerPageOptions={quoteRowsPerPageOptions}
                />
              </section>
            )}

          </main> {/* End Content Area */}
        </div> {/* End Main Content Wrapper */}
      </div> {/* End Dashboard Body */}

      {/* --- Dialogs --- */}

      {/* User Create/Edit Dialog */}
      <FormDialog
        isOpen={isUserDialogOpen}
        onClose={closeUserDialog}
        title={currentUser ? 'Modifier Utilisateur' : 'Ajouter Nouveau Utilisateur'}
        actions={
          <>
            <button onClick={closeUserDialog} className="modal-button cancel-button">Annuler</button>
            <button onClick={handleSaveUser} className="modal-button confirm-button">
              {currentUser ? 'Enregistrer Modifications' : 'Créer Utilisateur'}
            </button>
          </>
        }
      >
        {/* Dialog Error Display */}
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '15px' }}><span>{error.dialog}</span></div>}

        {/* User Form Fields */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name-sv">Prénom *</label>
            <input required id="name-sv" name="name" type="text" value={currentUser ? currentUser.name : newUser.name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="last_name-sv">Nom *</label>
            <input required id="last_name-sv" name="last_name" type="text" value={currentUser ? currentUser.last_name : newUser.last_name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, last_name: e.target.value }) : setNewUser({ ...newUser, last_name: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="email-sv">Adresse Email *</label>
          <input required id="email-sv" name="email" type="email" value={currentUser ? currentUser.email : newUser.email} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="password-sv">{currentUser ? 'Nouveau Mot de Passe (optionnel)' : 'Mot de Passe *'}</label>
          <input id="password-sv" name="password" type="password" placeholder={currentUser ? 'Laisser vide pour ne pas changer' : 'Minimum 8 caractères'} value={currentUser ? currentUser.password : newUser.password} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })} />
          {!currentUser && <small>Un email de configuration sera envoyé.</small>}
        </div>
         <div className="form-group">
          <label htmlFor="telephone-sv">Téléphone</label>
          <input
            id="telephone-sv" name="telephone" type="tel"
            value={currentUser ? currentUser.telephone : newUser.telephone}
            onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, telephone: e.target.value }) : setNewUser({ ...newUser, telephone: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="adresse-sv">Adresse</label>
          <input
            id="adresse-sv" name="adresse" type="text"
            value={currentUser ? currentUser.adresse : newUser.adresse}
            onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, adresse: e.target.value }) : setNewUser({ ...newUser, adresse: e.target.value })}
           />
        </div>
        <div className="form-group">
          <label htmlFor="role-select-sv">Rôle *</label>
          <select required id="role-select-sv" value={currentUser ? currentUser.role : newUser.role} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}>
            <option value="" disabled>Sélectionner Rôle</option>
            {/* Only show roles the supervisor can manage */}
            {manageableRoles.map(role => (<option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>))}
          </select>
        </div>
      </FormDialog>

      {/* Quote Create/Edit Dialog */}
      <FormDialog
        isOpen={isQuoteDialogOpen}
        onClose={closeQuoteDialog}
        title={currentQuoteId ? 'Modifier Devis Superviseur' : 'Ajouter Nouveau Devis Superviseur'}
        actions={
          <>
            <button onClick={closeQuoteDialog} className="modal-button cancel-button">Annuler</button>
            <button onClick={handleCreateOrUpdateQuote} className="modal-button confirm-button">
              {currentQuoteId ? 'Mettre à Jour Devis' : 'Créer Devis'}
            </button>
          </>
        }
      >
        {/* Dialog Error Display */}
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '15px' }}><span>{error.dialog}</span></div>}

        {/* Quote Form Fields */}
        <div className="form-group">
          <label htmlFor="appt-select-sv">Rendez-vous Associé *</label>
          {/* If editing, show read-only appointment */}
          {currentQuoteId && newQuote.appointment_id ? (
            <div className="readonly-appointment-label">
              <strong>
                {/* Find appointment name from the main list */}
                {appointments.find(appt => String(appt.id) === String(newQuote.appointment_id))?.prenom_du_prospect || 'Prospect Inconnu'}{' '}
                {appointments.find(appt => String(appt.id) === String(newQuote.appointment_id))?.nom_du_prospect || ''}
              </strong> (ID: {newQuote.appointment_id})
              <br/><small>Le rendez-vous ne peut pas être changé lors de la modification.</small>
            </div>
          ) : (
            /* If creating, show dropdown of available appointments */
            <select
              id="appt-select-sv"
              value={newQuote.appointment_id}
              onChange={(e) => setNewQuote({ ...newQuote, appointment_id: e.target.value })}
              required
              disabled={!!currentQuoteId} // Disable if editing
            >
              <option value="" disabled>Sélectionner un Rendez-vous</option>
              {loading.appointments && !availableAppointments.length ? (
                  <option value="" disabled>Chargement...</option>
              ) : availableAppointments.length > 0 ? (
                availableAppointments.map((appt) => (
                  <option key={appt.id} value={appt.id}>
                    {`${appt.prenom_du_prospect || ''} ${appt.nom_du_prospect || ''}`.trim()}
                    {appt.date_du_rdv ? ` (RDV: ${new Date(appt.date_du_rdv).toLocaleDateString('fr-FR')})` : ''} - ID: {appt.id}
                  </option>
                ))
              ) : (
                <option value="" disabled>Aucun RDV disponible pour nouveau devis.</option>
              )}
            </select>
          )}
        </div>

        <div className="form-group">
          <p style={{ fontSize: '0.9em', color: 'var(--text-light, #64748b)' }}>
            Le PDF du devis sera généré/mis à jour par le système avec les détails du RDV et les éléments ci-dessous.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="total_clinique-sv">Total Clinique (DT) *</label>
          <input
            id="total_clinique-sv" type="number" step="0.01" min="0"
            placeholder="Ex: 1500.00"
            value={newQuote.total_clinique}
            onChange={(e) => setNewQuote({ ...newQuote, total_clinique: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Éléments d'Assistance *</label>
          {newQuote.assistance_items.map((item, index) => (
            <div key={index} className="form-group-inline" style={{ marginBottom: '10px', alignItems: 'center' }}>
              <input
                type="text" placeholder="Libellé (Ex: Billet d'avion)"
                value={item.label}
                onChange={(e) => { const updated = [...newQuote.assistance_items]; updated[index].label = e.target.value; setNewQuote({ ...newQuote, assistance_items: updated }); }}
                required
                style={{ flexGrow: 1, marginRight: '10px' }}
              />
              <input
                type="number" placeholder="Montant (DT)" step="0.01" min="0"
                value={item.amount}
                onChange={(e) => { const updated = [...newQuote.assistance_items]; updated[index].amount = e.target.value; setNewQuote({ ...newQuote, assistance_items: updated }); }}
                required
                style={{ width: '120px', marginRight: '10px' }}
              />
              <button
                type="button"
                className="action-button button-small button-warning button-icon-only"
                onClick={() => {
                  if (newQuote.assistance_items.length > 1) { // Keep at least one item
                    const updated = [...newQuote.assistance_items];
                    updated.splice(index, 1);
                    setNewQuote({ ...newQuote, assistance_items: updated });
                  }
                }}
                title="Supprimer cet élément"
                disabled={newQuote.assistance_items.length <= 1} // Disable removing the last item
              >
                ❌
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setNewQuote({ ...newQuote, assistance_items: [...newQuote.assistance_items, { label: '', amount: '' }] })}
            className="action-button button-small"
            style={{ marginTop: '5px' }}
          >
            + Ajouter Élément d'Assistance
          </button>
        </div>
      </FormDialog>

    </>
  );
}

// --- Custom Pagination Component (Keep as is) ---
const CustomPagination = ({ count, rowsPerPage, page, onPageChange, onRowsPerPageChange, rowsPerPageOptions }) => {
  const totalPages = Math.ceil(count / rowsPerPage);
  const startRow = count === 0 ? 0 : page * rowsPerPage + 1;
  const endRow = Math.min(count, (page + 1) * rowsPerPage);

  const handlePreviousPage = () => { if (page > 0) onPageChange(page - 1); };
  const handleNextPage = () => { if (page < totalPages - 1) onPageChange(page + 1); };
  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    onRowsPerPageChange(newRowsPerPage); // Call handler passed from parent
  };

  return (
    <div className="pagination-controls">
      <div className="pagination-info">
        <span>Lignes par page :</span>
        <select className="pagination-rows-select" value={rowsPerPage} onChange={handleRowsPerPageChange} aria-label="Lignes par page">
          {rowsPerPageOptions.map(option => (<option key={option} value={option}>{option}</option>))}
        </select>
        <span style={{ marginLeft: '15px', fontWeight: '500' }}>{startRow}-{endRow} sur {count}</span>
      </div>
      <div className="pagination-buttons">
        <button onClick={handlePreviousPage} disabled={page === 0 || count === 0} aria-label="Page précédente">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Préc.
        </button>
        <button onClick={handleNextPage} disabled={page >= totalPages - 1 || count === 0} aria-label="Page suivante">
          Suiv. <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </div>
  );
};

// Export the SupervisorDashboard component
export default SupervisorDashboard;
