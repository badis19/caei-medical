import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDebounce } from 'react-use';
import axios from 'axios';

// --- IMPORT THE CSS FILE ---
import './dashboard.css'; // Adjust path if css file is in a different directory

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
    console.log("Logging out...");
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);
  return { logout };
};

// --- Reusable Toast Notification Component (Keep as is) ---
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

// --- Reusable Confirmation Modal Component (Keep as is - Might be useful for other confirmations later) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isLoading = false }) => {
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

// --- Reusable Dialog Component (Keep as is) ---
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
  const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10);
  const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
  const appointmentRowsPerPageOptions = useMemo(() => [5, 10, 25], []);
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
  const [newUser, setNewUser] = useState({ name: '', last_name: '', email: '', password: '', role: '' });
  // REMOVED: const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // REMOVED: const [userToDelete, setUserToDelete] = useState(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({ appointment_id: '', file: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('statistics');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // Keep for potential future confirmation dialogs
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', onConfirm: () => { } }); // Keep
  const [modalLoading, setModalLoading] = useState(false); // Keep
  const [modalError, setModalError] = useState('');


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

  // Updated: This function can be used for *any* confirmation now, not just delete.
  const openConfirmationModal = useCallback(({ title, message, onConfirm, confirmText = 'Confirm' }) => {
    if (!isMountedRef.current) return;
    setModalError('');
    setModalConfig({ title, message, onConfirm, confirmText });
    setIsModalOpen(true);
    // REMOVED: setIsDeleteDialogOpen(true);
  }, []);

  const closeConfirmationModal = useCallback(() => {
    setIsModalOpen(false);
    // REMOVED: setIsDeleteDialogOpen(false);
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
        // If the action was successful, the onConfirm function itself should call closeConfirmationModal
      } catch (error) {
        console.error("Modal confirmation action failed:", error);
        // Display error within the modal or as a toast
        setError(prev => ({ ...prev, dialog: error.message || 'An unexpected error occurred during confirmation.' })); // Example: Set dialog error
        showToast(error.message || 'Confirmation action failed.', 'error');
        setModalLoading(false); // Stop loading indicator on error
        // Decide whether to close the modal on error or not
        // closeConfirmationModal(); // Or keep it open to show the error
      }
    } else {
      closeConfirmationModal(); // Close if no confirm action defined
    }
    // Include necessary dependencies, potentially modalConfig.onConfirm if it changes
  }, [modalConfig, closeConfirmationModal, showToast]);


  // --- Data Fetching Functions (Keep as is) ---
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
      setError(prev => ({ ...prev, users: 'Failed to fetch users.' }));
      showToast('Failed to load users. Please try refreshing.', 'error');
      setUsers([]); setUserTotalRows(0);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, users: false }));
    }
  }, [userRowsPerPageOptions, showToast]);

  const fetchAppointments = useCallback(async (page = 0, limit = 1000) => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, appointments: true }));
    setError(prev => ({ ...prev, appointments: null }));
    try {
      const response = await apiClient.get(`/admin/appointments?limit=${limit}`);
      if (!isMountedRef.current) return;
      const responseData = response.data?.data || [];
      const total = response.data?.total || 0;
      const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0;
      let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;
      if (!appointmentRowsPerPageOptions.includes(perPage)) {
        perPage = appointmentRowsPerPageOptions.includes(limit) ? limit : appointmentRowsPerPageOptions[0];
      }
      setAppointments(responseData);
      setAppointmentTotalRows(total);
      setAppointmentPage(currentPage);
      setAppointmentRowsPerPage(perPage);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, appointments: 'Failed to fetch appointments.' }));
      showToast('Failed to load appointments.', 'error');
      setAppointments([]); setAppointmentTotalRows(0);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, appointments: false }));
    }
  }, [appointmentRowsPerPageOptions, showToast]);

  const fetchQuotes = useCallback(async (page = 0, limit = 10, search = '') => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, quotes: true }));
    setError(prev => ({ ...prev, quotes: null }));
    try {
      const apiPage = page + 1; // API pagination is often 1-based

      // Fetch only regular quotes
      const quotesRes = await apiClient.get(`/admin/quotes?page=${apiPage}&limit=${limit}&search=${search}`);

      // Extract data and pagination info from the response
      // Adjust based on your actual API response structure
      const responseData = quotesRes.data?.data || {}; // Assuming Laravel pagination structure { data: [], links: {}, meta: {} } or similar { data: [], total: N, ... }
      const quotes = Array.isArray(responseData) ? responseData : (responseData.data || []); // Handle different structures
      const total = responseData.total || quotesRes.data?.total || 0; // Get total count from response meta/top level
      const currentPage = responseData.current_page ? responseData.current_page - 1 : (quotesRes.data?.current_page ? quotesRes.data.current_page - 1 : 0); // API current page (usually 1-based) to 0-based
      let perPage = responseData.per_page ? Number(responseData.per_page) : (quotesRes.data?.per_page ? Number(quotesRes.data.per_page) : limit); // Get per_page from response

      // Validate perPage against options if necessary, or just trust API
      if (!quoteRowsPerPageOptions.includes(perPage)) {
        perPage = quoteRowsPerPageOptions.includes(limit) ? limit : quoteRowsPerPageOptions[1]; // Sensible default
      }

      if (!isMountedRef.current) return; // Check mount status *after* await

      // Set state using data from the API response
      setQuotes(quotes);
      setQuoteTotalRows(total);
      setQuotePage(currentPage);
      setQuoteRowsPerPage(perPage);

    } catch (err) {
      console.error("Failed to fetch quotes:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, quotes: 'Failed to fetch quotes.' }));
      showToast('Failed to load quotes.', 'error');
      setQuotes([]); // Reset on error
      setQuoteTotalRows(0); // Reset on error
      setQuotePage(0); // Reset page on error
      // Optionally reset rowsPerPage if needed
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, quotes: false }));
    }
    // Update dependencies: remove quoteRowsPerPageOptions if API dictates limit, otherwise keep it if user can change it.
    // Add limit to dependencies if it's used directly and can change outside of pagination controls.
  }, [showToast, quoteRowsPerPageOptions]); // Keep options if user select affects `limit` passed in


  const fetchStatistics = useCallback(async (month, year) => {
    if (!isMountedRef.current) return;
    setLoading(prev => ({ ...prev, stats: true }));
    setError(prev => ({ ...prev, stats: null }));
    try {
      const response = await apiClient.get(`/admin/statistics?month=${month}&year=${year}`);
      if (!isMountedRef.current) return;
      if (response.data && Array.isArray(response.data.labels) && Array.isArray(response.data.datasets)) {
        setStatistics(response.data);
      } else {
        console.warn("Statistics API response format unexpected.", response.data);
        setError(prev => ({ ...prev, stats: 'Statistics data format incorrect.' }));
        setStatistics(null);
        showToast("Received unexpected statistics format.", 'error');
      }
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
      if (!isMountedRef.current) return;
      setError(prev => ({ ...prev, stats: `Failed to fetch statistics (${err.response?.status || 'Network Error'}).` }));
      showToast("Could not load statistics.", 'error');
      setStatistics(null);
    } finally {
      if (isMountedRef.current) setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [showToast]);

  // --- Debounce Hooks (Keep as is) ---
  useDebounce(() => {
    setDebouncedUserSearch(userSearch);
    // Pass debounced search value to fetchUsers
    fetchUsers(0, userRowsPerPage, userSearch, selectedRoleFilter);
  }, 500, [userSearch, userRowsPerPage, selectedRoleFilter, fetchUsers]); // userSearch triggers debounce

  useDebounce(() => {
    setDebouncedQuoteSearch(quoteSearch);
    // Pass debounced search value to fetchQuotes
    fetchQuotes(0, quoteRowsPerPage, quoteSearch);
  }, 500, [quoteSearch, quoteRowsPerPage, fetchQuotes]); // quoteSearch triggers debounce


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
          // Initial fetch uses empty search strings
          await Promise.all([
            fetchUsers(userPage, userRowsPerPage, '', selectedRoleFilter), // Use empty search initially
            fetchAppointments(appointmentPage, 1000),
            fetchQuotes(quotePage, quoteRowsPerPage, ''), // Use empty search initially
            fetchStatistics(statsMonth, statsYear)
          ]);
        } else {
          setError(prev => ({ ...prev, general: 'Access Denied: Admin role required.' }));
          handleLogout();
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!isMountedRef.current) return;
        if (err.response?.status === 401) {
          setError(prev => ({ ...prev, general: 'Session expired. Please login again.' }));
          showToast('Session expired. Please login again.', 'error');
        } else {
          setError(prev => ({ ...prev, general: 'Authentication failed. Please login again.' }));
          showToast('Authentication failed.', 'error');
        }
        handleLogout();
      } finally {
        if (isMountedRef.current) setLoading(prev => ({ ...prev, auth: false }));
      }
    };
    checkAuthAndFetch();
    return () => {
      isMountedRef.current = false;
      console.log("Admin Dashboard Unmounting");
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]); // Only navigate needed here for initial load/auth check

  // Fetch statistics when month/year changes
  useEffect(() => {
    if (userRole === 'administrateur' && statsMonth && statsYear && isMountedRef.current) {
      fetchStatistics(statsMonth, statsYear);
    }
  }, [statsMonth, statsYear, userRole, fetchStatistics]);

  // Fetch users when role filter changes (debounce handles search input changes)
  useEffect(() => {
    if (userRole === 'administrateur' && !loading.auth && isMountedRef.current) {
      // Use the debounced value here to avoid rapid calls when filter changes
      fetchUsers(0, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleFilter, userRole, fetchUsers]); // fetchUsers dependency is correct


  // --- CRUD Handlers ---
  const handleSaveUser = async () => {
    const isEditing = !!currentUser;
    const userData = isEditing ? { ...currentUser, password: currentUser.password || undefined } : newUser;
    if (!userData.name || !userData.last_name || !userData.email || !userData.role) {
      setError(prev => ({ ...prev, dialog: "Please fill in all required fields." }));
      showToast("Please fill in all required fields.", 'error');
      return;
    }
    if (!isEditing && !userData.password) {
      setError(prev => ({ ...prev, dialog: "Password is required for new users." }));
      showToast("Password is required for new users.", 'error');
      return;
    }
    if (userData.password && userData.password.length < 8) {
      setError(prev => ({ ...prev, dialog: "Password must be at least 8 characters long." }));
      showToast("Password must be at least 8 characters long.", 'error');
      return;
    }
    setError(prev => ({ ...prev, dialog: null }));
    const url = isEditing ? `/admin/users/${currentUser.id}` : '/admin/users';
    const method = isEditing ? 'put' : 'post';
    try {
      const response = await apiClient[method](url, userData, { headers: { 'Content-Type': 'application/json' } });
      closeUserDialog();
      // Refresh users with current pagination and filter settings
      fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
      showToast(`User "${response.data.name}" ${isEditing ? 'updated' : 'created'} successfully.`, 'success');
    } catch (err) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} user:`, err.response?.data);
      const errors = err.response?.data?.errors;
      let errorMsg = `Failed to ${isEditing ? 'update' : 'create'} user.`;
      if (errors) {
        errorMsg += " " + Object.values(errors).flat().join(' ');
      } else {
        errorMsg += " " + (err.response?.data?.message || 'Please check details and try again.');
      }
      setError(prev => ({ ...prev, dialog: errorMsg }));
      showToast(errorMsg, 'error');
    }
  };

  // REMOVED: confirmDeleteUser function

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await apiClient.post(`/admin/users/${userId}/toggle-status`);
      const isActive = response.data?.is_active;
      showToast(`User account ${isActive ? 'activated' : 'deactivated'}.`, 'success');
      // Refresh users with current pagination and filter settings
      fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
    } catch (err) {
      console.error("Failed to toggle user status:", err);
      showToast("Failed to update user status. " + (err.response?.data?.message || ''), 'error');
    }
  };

  const viewPatientFiles = async (userId) => {
    try {
      const responseFiles = await apiClient.get(`/admin/users/${userId}/patient-files`);
      const files = responseFiles.data;
      if (!files || files.length === 0) {
        showToast('This patient has not uploaded any files.', 'info');
        return;
      }
      const firstFile = files[0];
      const fileId = firstFile.id;
      const fileName = firstFile.file_name || `medical_file_${fileId}.pdf`;
      const token = localStorage.getItem('token');
      const responseBlob = await fetch(`${apiClient.defaults.baseURL}/admin/files/${fileId}/download`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }
      });
      if (!responseBlob.ok) {
        const errorData = await responseBlob.text();
        throw new Error(`Download failed with status ${responseBlob.status}. ${errorData}`);
      }
      const blob = await responseBlob.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to fetch or download patient files:", err);
      showToast("Failed to download patient file. " + (err.message || ''), 'error');
    }
  };

  const viewClinicQuote = (url) => {
    window.open(url, '_blank');
  };



  const handleUploadQuoteFile = async (quoteId, file) => {
    if (!file) { showToast("No file selected.", 'info'); return; }
    if (file.type !== "application/pdf") { showToast("Please select a PDF file.", 'error'); return; }
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) { showToast(`File size exceeds 20MB limit.`, 'error'); return; }
    const formData = new FormData();
    formData.append('file', file);
    showToast("Uploading PDF...", 'info', 60000);
    try {
      await apiClient.post(`/admin/quotes/${quoteId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast("PDF uploaded successfully!", 'success');
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
    } catch (err) {
      console.error('Upload failed:', err.response?.data || err.message);
      let errorMsg = 'Failed to upload PDF.';
      if (err.response?.data?.message) errorMsg += ` ${err.response.data.message}`;
      else if (err.response?.status === 413) errorMsg = 'File too large (Max: 20MB).';
      else if (err.response?.status === 422 && err.response.data.errors?.file) errorMsg += ` ${err.response.data.errors.file.join(' ')}`;
      else errorMsg += ' Please try again.';
      showToast(errorMsg, 'error');
    }
  };

  const handleCreateQuote = async () => {
    const { appointment_id, file } = newQuote;
    if (!appointment_id || !file) {
      setError(prev => ({ ...prev, dialog: "Please select an appointment and a PDF file." }));
      showToast("Please select an appointment and a PDF file.", 'error'); return;
    }
    if (file.type !== "application/pdf") {
      setError(prev => ({ ...prev, dialog: "Please select a PDF file." }));
      showToast("Please select a PDF file.", 'error'); return;
    }
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setError(prev => ({ ...prev, dialog: `File size exceeds 20MB limit.` }));
      showToast(`File size exceeds 20MB limit.`, 'error'); return;
    }
    setError(prev => ({ ...prev, dialog: null }));
    const formData = new FormData();
    formData.append("appointment_id", appointment_id);
    formData.append("file", file);
    showToast("Creating quote...", 'info', 60000);
    try {
      await apiClient.post("/admin/quotes", formData);
      showToast("Quote added successfully!", 'success');
      setIsQuoteDialogOpen(false);
      setNewQuote({ appointment_id: '', file: null });
      fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
      fetchAppointments(appointmentPage, 1000);
    } catch (err) {
      console.error("Failed to create quote:", err.response?.data || err.message);
      let errorMsg = "Failed to create quote.";
      if (err.response?.data?.message) { errorMsg = err.response.data.message; }
      else if (err.response?.status === 413) { errorMsg = 'File is too large (Max: 20MB).'; }
      else if (err.response?.status === 422) {
        errorMsg = 'Validation failed.';
        if (err.response.data.errors?.file) errorMsg += ` File: ${err.response.data.errors.file.join(' ')}`;
        if (err.response.data.errors?.appointment_id) errorMsg += ` Appointment: ${err.response.data.errors.appointment_id.join(' ')}`;
      }
      setError(prev => ({ ...prev, dialog: errorMsg }));
      showToast(errorMsg, 'error');
    }
  };

  const handleLogout = () => {
    logout();
  };


  // --- Dialog Management ---
  const openUserDialog = (user = null) => {
    setError(prev => ({ ...prev, dialog: null }));
    if (user) {
      const roleName = user.roles?.length > 0 ? user.roles[0].name : (user.role || '');
      setCurrentUser({ ...user, password: '', role: roleName });
      setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
    } else {
      setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
      setCurrentUser(null);
    }
    setIsUserDialogOpen(true);
  };

  const closeUserDialog = () => {
    setIsUserDialogOpen(false);
    setCurrentUser(null);
    setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
    setError(prev => ({ ...prev, dialog: null }));
  };

  // REMOVED: openDeleteDialog function

  const openQuoteDialog = () => {
    setError(prev => ({ ...prev, dialog: null }));
    setNewQuote({ appointment_id: '', file: null });
    setIsQuoteDialogOpen(true);
  };

  const closeQuoteDialog = () => {
    setIsQuoteDialogOpen(false);
    setNewQuote({ appointment_id: '', file: null });
    setError(prev => ({ ...prev, dialog: null }));
  };


  // --- Table Pagination Handlers (Keep as is) ---
  const handleChangeUserPage = (newPage) => {
    fetchUsers(newPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
  };

  const handleChangeUserRowsPerPage = (newLimit) => {
    fetchUsers(0, newLimit, debouncedUserSearch, selectedRoleFilter);
  };

  const handleChangeAppointmentPage = (newPage) => {
    console.log("Appointment page changed (if table exists):", newPage);
  };

  const handleChangeAppointmentRowsPerPage = (newLimit) => {
    console.log("Appointment rows per page changed (if table exists):", newLimit);
  };

  const handleChangeQuotePage = (newPage) => {
    fetchQuotes(newPage, quoteRowsPerPage, debouncedQuoteSearch);
  };

  const handleChangeQuoteRowsPerPage = (newLimit) => {
    fetchQuotes(0, newLimit, debouncedQuoteSearch);
  };


  // --- Memoized Chart Data (Keep as is) ---
  const chartData = useMemo(() => {
    if (!statistics || !Array.isArray(statistics.labels) || !Array.isArray(statistics.datasets)) return [];
    const validDatasets = statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data));
    if (validDatasets.length === 0 && statistics.labels.length > 0) {
      return statistics.labels.map(dayLabel => ({ day: dayLabel }));
    }
    return statistics.labels.map((dayLabel, index) => {
      const dataPoint = { day: dayLabel };
      validDatasets.forEach(dataset => {
        dataPoint[dataset.label] = dataset.data[index] ?? 0;
      });
      return dataPoint;
    });
  }, [statistics]);


  // --- Set Active Section (Keep as is) ---
  const setSection = (section) => {
    setActiveSection(section);
    if (window.innerWidth < 992) {
      setSidebarOpen(false);
    }
  };


  // --- Render Logic (Keep as is) ---
  if (loading.auth) {
    return (
      <div className="loading-container dashboard-body">
        <div className="simple-spinner"></div>
        {/* Use CSS variable for text color */}
        <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>Verifying Authentication...</p>
      </div>
    );
  }

  if (!userRole && !loading.auth) {
    return (
      <div className="error-container dashboard-body">
        <p>{error.general || 'Access Denied. Administrator role required.'}</p>
        <button onClick={() => navigate('/login')} className="action-button">Go to Login</button>
      </div>
    );
  }


  // --- Main Dashboard Render ---
  return (
    <>
      {/* Render Toast Notification */}
      {isToastVisible && (<ToastNotification message={toastMessage} type={toastType} />)}

      {/* Render Confirmation Modal (Kept for general use) */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleModalConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        isLoading={modalLoading}
      />

      {/* Main Body Structure */}
      <div className="dashboard-body">
        {/* Header */}
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div className="header-title">Admin Dashboard</div>
          <div className="header-actions">
            <button onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="main-content-wrapper">
          {/* Sidebar */}
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <button className={`sidebar-button ${activeSection === 'statistics' ? 'active' : ''}`} onClick={() => setSection('statistics')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg>
              Statistics
            </button>
            <button className={`sidebar-button ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setSection('users')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Users
            </button>
            <button className={`sidebar-button ${activeSection === 'appointments' ? 'active' : ''}`} onClick={() => setSection('appointments')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Appointments
            </button>
            <button className={`sidebar-button ${activeSection === 'quotes' ? 'active' : ''}`} onClick={() => setSection('quotes')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              Quotes
            </button>
          </aside>

          {/* Content Area */}
          <main className="content-area">
            <div className="content-overlay" onClick={() => setSidebarOpen(false)}></div>

            {/* General Error Alert */}
            {error.general && !isUserDialogOpen && !isQuoteDialogOpen && !isModalOpen && ( // Hide general error if a dialog/modal is open
              <div className="alert-message alert-message-error">
                <span>{error.general}</span>
                <button className="alert-close-btn" onClick={() => setError(prev => ({ ...prev, general: null }))}>×</button>
              </div>
            )}

            {/* --- Statistics Section --- */}
            {activeSection === 'statistics' && (
              <section className="content-section">
                <div className="section-header"><h3>Platform Statistics</h3></div>
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="stats-month">Month</label>
                    <select id="stats-month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} disabled={loading.stats}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m)}>
                          {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="stats-year">Year</label>
                    <select id="stats-year" value={statsYear} onChange={(e) => setStatsYear(e.target.value)} disabled={loading.stats}>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {loading.stats && <div className="simple-spinner" style={{ width: '28px', height: '28px', marginLeft: '10px' }}></div>}
                </div>
                <div className="chart-container">
                  {loading.stats ? (
                    <div className="chart-loading-overlay"><div className="simple-spinner"></div></div>
                  ) : statistics && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="day" stroke="var(--text-light)" />
                        <YAxis allowDecimals={false} stroke="var(--text-light)" />
                        <RechartsTooltip cursor={{ fill: 'rgba(194, 155, 110, 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data)).map((dataset, idx) => (
                          <Bar
                            key={dataset.label || idx}
                            dataKey={dataset.label}
                            fill={chartColors[idx % chartColors.length]}
                            radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : error.stats ? (
                    <div className="alert-message alert-message-warning" style={{ margin: 'auto', maxWidth: '400px' }}><span>{error.stats}</span></div>
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: '60px', fontSize: '1.1em' }}>
                      No appointment data available for the selected period.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* --- User Management Section --- */}
            {activeSection === 'users' && (
              <section className="content-section">
                <div className="section-header">
                  <h3>User Management</h3>
                  <button className="action-button button-small" onClick={() => openUserDialog()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add User
                  </button>
                </div>
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="user-search" className="sr-only">Search Users</label>
                    <input
                      id="user-search"
                      type="text"
                      placeholder="Search Users (Name or Email)"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      disabled={loading.users}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="role-filter" className="sr-only">Filter by Role</label>
                    <select
                      id="role-filter"
                      value={selectedRoleFilter}
                      onChange={(e) => setSelectedRoleFilter(e.target.value)}
                      disabled={loading.users}
                    >
                      <option value="">All Roles</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  {loading.users && <div className="simple-spinner" style={{ width: '28px', height: '28px' }}></div>}
                </div>
                {error.users && <div className="alert-message alert-message-warning"><span>{error.users}</span></div>}
                <div className="table-container">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role(s)</th>
                        <th>Status</th>
                        <th className="actions-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.users ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : users.length > 0 ? users.map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.name} {user.last_name}</strong></td>
                          <td>{user.email}</td>
                          <td>{user.roles?.map(r => r.name).join(', ') || user.role || 'N/A'}</td>
                          <td>
                            <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button
                              className="action-button button-small button-icon-only button-outline"
                              onClick={() => openUserDialog(user)}
                              title="Edit User"
                              aria-label="Edit user"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                            </button>
                            {/* REMOVED Delete Button */}
                            {/*
                             <button
                                className="action-button button-small button-icon-only button-danger-outline"
                                onClick={() => openDeleteDialog(user)} // This function is removed
                                title="Delete User"
                                aria-label="Delete user"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                             </button>
                            */}
                            <button
                              className={`action-button button-small ${user.is_active ? 'button-warning' : 'button-success'}`}
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              title={user.is_active ? 'Deactivate User' : 'Activate User'}
                              style={{ minWidth: '80px' }}
                            >
                              {user.is_active ? 'Disable' : 'Enable'}
                            </button>
                            {user.roles?.some(r => r.name === 'patient') && (
                              <button
                                className="action-button button-small button-outline"
                                onClick={() => viewPatientFiles(user.id)}
                                title="View Patient Uploaded Files"
                                style={{ minWidth: '90px' }}
                              >
                                View PDFs
                              </button>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr className="no-results-row"><td colSpan="5">No users found matching the criteria.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
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

            {/* --- Appointments Section (Keep as is) --- */}
            {activeSection === 'appointments' && (
              <section className="content-section">
                <div className="section-header"><h3>Recent Appointments Preview</h3></div>
                {error.appointments && <div className="alert-message alert-message-warning"><span>{error.appointments}</span></div>}
                <div className="table-container">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Prospect</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.appointments ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : appointments.length > 0 ? ( // <-- Note: No longer needs to be an array here, can be simplified if desired, but leaving as is for now works
                        appointments.slice(0, 20).map(appt => (
                          <tr key={appt.id}>
                            <td><strong>{appt.prenom_du_prospect} {appt.nom_du_prospect}</strong></td>
                            <td>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleDateString() : 'N/A'}</td>
                            <td>
                              {appt.status || 'N/A'}
                              {appt.clinic_quote_url && (
                                <div style={{ marginTop: '6px' }}>
                                  <button
                                    onClick={() => viewClinicQuote(appt.clinic_quote_url)}
                                    

                                    className="action-button button-link"
                                    style={{ fontSize: '0.85em', color: '#1e40af', padding: '0', background: 'none', border: 'none', textDecoration: 'underline' }}
                                  >
                                    View Clinic Quote
                                  </button>


                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="no-results-row"><td colSpan="3">No recent appointments found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.9em', color: 'var(--text-light)', marginTop: '15px', textAlign: 'center' }}>
                  Note: Full appointment list is loaded for the quote creation dropdown. This table shows a preview.
                </p>
              </section>
            )}

            {/* --- Quotes Section (Keep as is) --- */}
            {activeSection === 'quotes' && (
              <section className="content-section">
                <div className="section-header">
                  <h3>Recent Quotes</h3>
                  <button className="action-button button-small" onClick={openQuoteDialog}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Quote
                  </button>
                </div>
                <div className="filter-controls">
                  <div className="form-group">
                    <label htmlFor="quote-search" className="sr-only">Search Quotes</label>
                    <input
                      id="quote-search"
                      type="text"
                      placeholder="Search Quotes (Prospect Name/ID)"
                      value={quoteSearch}
                      onChange={(e) => setQuoteSearch(e.target.value)}
                      disabled={loading.quotes}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {loading.quotes && <div className="simple-spinner" style={{ width: '28px', height: '28px' }}></div>}
                </div>
                {error.quotes && <div className="alert-message alert-message-warning"><span>{error.quotes}</span></div>}
                <div className="table-container">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Prospect (Appt)</th>
                        <th>Amount Info</th>
                        <th>Status</th>
                        <th>Comment</th>
                        <th style={{ textAlign: 'center' }}>PDF Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.quotes ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}><div className="simple-spinner" style={{ margin: 'auto' }}></div></td></tr>
                      ) : quotes.filter(q => !q.is_clinic).length > 0 ? quotes.filter(q => !q.is_clinic).map(quote => (
                        <tr key={quote.id}>
                          <td>{quote.id}</td>
                          <td>
                            <strong>
                              {quote.appointment
                                ? `${quote.appointment.prenom_du_prospect || ''} ${quote.appointment.nom_du_prospect || ''}`
                                : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No Appointment</span>}
                            </strong>
                          </td>
                          <td>
                            {(quote.file_path || quote.filename) ? <span style={{ color: 'var(--text-light)' }}>See PDF</span> : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No file</span>}
                          </td>
                          <td>{quote.status || 'N/A'}</td>
                          <td className="comment-cell" data-tooltip={quote.status === 'refused' ? (quote.comment || 'No comment provided') : ''}>
                            {quote.status === 'refused' ? (quote.comment || <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No comment</span>) : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {(quote.file_path || quote.filename) ? (
                              <button
                                className="action-button button-small button-outline"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('token');
                                    const downloadEndpoint = `${apiClient.defaults.baseURL}/admin/quotes/${quote.id}/download`;
                                    const response = await fetch(downloadEndpoint, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } });
                                    if (!response.ok) throw new Error(`Download failed (${response.status})`);
                                    const blob = await response.blob();
                                    const downloadUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a'); a.href = downloadUrl;
                                    a.download = quote.filename || `quote_${quote.id}.pdf`;
                                    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(downloadUrl);
                                  } catch (err) { console.error('Error downloading PDF:', err); showToast(`Could not download PDF. ${err.message}`, 'error'); }
                                }}
                                title={`Download PDF (${quote.filename || 'Quote'})`}
                              >
                                Download PDF
                              </button>
                            ) : (
                              <label className="action-button button-small button-link" style={{ cursor: 'pointer' }} title="Upload Quote PDF">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                Upload PDF
                                <small style={{ marginLeft: '4px', color: 'var(--text-light)', display: 'block', fontSize: '0.8em' }}>(Max: 20MB)</small>
                                <input
                                  type="file"
                                  hidden
                                  accept="application/pdf"
                                  onClick={(e) => { e.target.value = ''; }}
                                  onChange={(e) => handleUploadQuoteFile(quote.id, e.target.files?.[0])}
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr className="no-results-row"><td colSpan="6">No recent quotes found.</td></tr>
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

          </main> {/* End Content Area */}
        </div> {/* End Main Content Wrapper */}
      </div> {/* End Dashboard Body */}

      {/* --- Dialogs (Keep as is) --- */}
      <FormDialog
        isOpen={isUserDialogOpen}
        onClose={closeUserDialog}
        title={currentUser ? 'Edit User' : 'Add New User'}
        actions={
          <>
            <button onClick={closeUserDialog} className="modal-button cancel-button">Cancel</button>
            <button onClick={handleSaveUser} className="modal-button confirm-button">{currentUser ? 'Save Changes' : 'Create User'}</button>
          </>
        }
      >
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '20px' }}><span>{error.dialog}</span></div>}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name">First Name *</label>
            <input required id="name" name="name" type="text" value={currentUser ? currentUser.name : newUser.name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="last_name">Last Name *</label>
            <input required id="last_name" name="last_name" type="text" value={currentUser ? currentUser.last_name : newUser.last_name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, last_name: e.target.value }) : setNewUser({ ...newUser, last_name: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input required id="email" name="email" type="email" value={currentUser ? currentUser.email : newUser.email} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="password">{currentUser ? 'New Password' : 'Password *'}</label>
          <input id="password" name="password" type="password" value={currentUser ? currentUser.password : newUser.password} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })} />
          <small>{currentUser ? 'Leave empty to keep current password.' : 'Min 8 characters. Setup email will be sent.'}</small>
        </div>
        <div className="form-group">
          <label htmlFor="role-select">Role *</label>
          <select required id="role-select" value={currentUser ? currentUser.role : newUser.role} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}>
            <option value="" disabled>Select Role</option>
            {roles.map(role => (<option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>))}
          </select>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={isQuoteDialogOpen}
        onClose={closeQuoteDialog}
        title="Add New Quote"
        actions={
          <>
            <button onClick={closeQuoteDialog} className="modal-button cancel-button">Cancel</button>
            <button onClick={handleCreateQuote} className="modal-button confirm-button">Create Quote</button>
          </>
        }
      >
        {error.dialog && <div className="alert-message alert-message-error" style={{ marginBottom: '20px' }}><span>{error.dialog}</span></div>}
        <div className="form-group">
          <label htmlFor="appt-select">Appointment *</label>
          <select
            id="appt-select"
            value={newQuote.appointment_id}
            onChange={(e) => setNewQuote({ ...newQuote, appointment_id: e.target.value })}
            required
          >
            <option value="" disabled>Select an Appointment</option>
            {loading.appointments ? (
              <option value="" disabled>Loading appointments...</option>
            ) : appointments.length > 0 ? (
              appointments.map((appt) => {
                const alreadyQuoted = quotes.some(q => q.appointment_id === appt.id);
                return (
                  <option key={appt.id} value={appt.id} disabled={alreadyQuoted}>
                    {`${appt.prenom_du_prospect || ''} ${appt.nom_du_prospect || ''}`.trim()}
                    {appt.date_du_rdv ? ` (${new Date(appt.date_du_rdv).toLocaleDateString()})` : ''}
                    {` - ID: ${appt.id}`}
                    {alreadyQuoted ? " (Quote exists)" : ""}
                  </option>
                );
              })
            ) : (
              <option value="" disabled>No appointments available or failed to load.</option>
            )}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="quote-pdf">Upload Quote PDF *</label>
          <input
            id="quote-pdf"
            type="file"
            required
            accept="application/pdf"
            onClick={(e) => { e.target.value = ''; }}
            onChange={(e) => setNewQuote({ ...newQuote, file: e.target.files?.[0] || null })}
          />
          {newQuote.file && <small>Selected: {newQuote.file.name} ({(newQuote.file.size / 1024 / 1024).toFixed(2)} MB)</small>}
          <small>Max file size: 20MB. Only PDF format accepted.</small>
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

  const handlePreviousPage = () => {
    if (page > 0) {
      onPageChange(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) {
      onPageChange(page + 1);
    }
  };

  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    onRowsPerPageChange(newLimit);
  };

  return (
    <div className="pagination-controls">
      <div className="pagination-info">
        <span>Rows per page:</span>
        <select
          className="pagination-rows-select"
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          aria-label="Rows per page"
        >
          {rowsPerPageOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <span style={{ marginLeft: '15px', fontWeight: '500' }}>
          {startRow}-{endRow} of {count}
        </span>
      </div>
      <div className="pagination-buttons">
        <button onClick={handlePreviousPage} disabled={page === 0} aria-label="Previous page">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Prev
        </button>
        <button onClick={handleNextPage} disabled={page >= totalPages - 1} aria-label="Next page">
          Next
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
