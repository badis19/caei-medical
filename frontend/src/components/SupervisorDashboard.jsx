import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Removed axios import as apiClient is created below
// import axios from '../axios'; // Assuming '../axios' is your configured Axios instance
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../AuthContext.jsx';

// Import Recharts components needed for the chart
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'; // Renamed Recharts Tooltip
import { useDebounce } from 'react-use'; // Or any debounce hook/utility

// Material UI Components
import {
    AppBar, Toolbar, Typography, Container, Grid, Card, CardHeader, CardContent, Button, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper, Box,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, MenuItem, InputLabel, FormControl,
    CircularProgress, Alert, IconButton, Skeleton, Tooltip, Drawer, List, ListItem, ListItemText, ListItemIcon,Link
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';

// Import both ToastContainer and toast from react-toastify
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Import the CSS

// --- Axios Client Setup ---
// NOTE: This assumes you have an axios instance configured elsewhere or you install axios
// If not, you might need to install axios: npm install axios or yarn add axios
// and configure it here or import a configured instance.
// For demonstration, creating a basic instance here.
import axios from 'axios'; // Import axios directly if not configured elsewhere

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api', // Use env variable
    headers: {
        'Accept': 'application/json',
    }
});

// Add interceptor to include token in requests
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// --- Main Dashboard Component ---
function SupervisorDashboard() {
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState(null);

    // Data States
    const [users, setUsers] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [quotes, setQuotes] = useState([]); // State for quotes (used in dropdown disabling)

    // Pagination States
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

    // Filter/Search States
    const [userSearch, setUserSearch] = useState('');
    const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState(''); // State for role filter
    const [quoteSearch, setQuoteSearch] = useState('');
    const [debouncedQuoteSearch, setDebouncedQuoteSearch] = useState(''); // Added debounce for quotes
    const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1)); // Default to current month
    const [statsYear, setStatsYear] = useState(String(new Date().getFullYear())); // Default to current year

    // UI / Form States
    const [loading, setLoading] = useState({ users: false, appointments: false, stats: false, quotes: false, auth: true });
    const [error, setError] = useState({ users: null, appointments: null, stats: null, quotes: null, general: null });
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [newUser, setNewUser] = useState({ name: '', last_name: '', email: '', password: '', role: '' });
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    // State for Add Quote Dialog
    const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
    const [newQuote, setNewQuote] = useState({ appointment_id: '', file: null });

    // Sidebar State
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Active Section State
    const [activeSection, setActiveSection] = useState('statistics'); // Default to statistics

    // Available roles for dropdowns
    const roles = useMemo(() => ['agent', 'confirmateur', 'patient', 'clinique'], []);

    // --- Data Fetching Functions (Declared BEFORE useDebounce) ---

    // **UPDATED fetchUsers to include role filter parameter**
    const fetchUsers = useCallback(async (page = 0, limit = 10, search = '', role = '') => {
        setLoading(prev => ({ ...prev, users: true }));
        setError(prev => ({ ...prev, users: null }));
        try {
            const apiPage = page + 1; // API pagination is usually 1-based
            // Construct the query parameters, adding role only if it's selected
            const queryParams = new URLSearchParams({
                page: apiPage,
                limit: limit,
                search: search,
            });
            if (role) {
                queryParams.append('role', role); // Add role filter if provided
            }

            const response = await apiClient.get(`/superviseur/users?${queryParams.toString()}`);
            const responseData = response.data?.data || [];
            const total = response.data?.total || 0;
            const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0;
            let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;

            // Ensure perPage from API is one of the allowed options
            if (!userRowsPerPageOptions.includes(perPage)) {
                console.warn(`API returned per_page=${perPage} not in options for users. Defaulting to ${limit} or ${userRowsPerPageOptions[1]}`);
                perPage = userRowsPerPageOptions.includes(limit) ? limit : userRowsPerPageOptions[1]; // Default to 10 if limit isn't valid either
            }

            setUsers(responseData);
            setUserTotalRows(total);
            setUserPage(currentPage);
            setUserRowsPerPage(perPage); // Set rows per page based on API or default
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(prev => ({ ...prev, users: 'Failed to fetch users.' }));
            toast.error('Failed to load users. Please try refreshing.');
            setUsers([]);
            setUserTotalRows(0);
        } finally {
            setLoading(prev => ({ ...prev, users: false }));
        }
    }, [userRowsPerPageOptions]); // Dependency array for useCallback

    const fetchAppointments = useCallback(async (page = 0, limit = 10) => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const apiPage = page + 1;
            // Fetch *all* appointments for the dropdown, not just paginated ones
            const response = await apiClient.get(`/superviseur/appointments?limit=1000`); // Fetch a large number for the dropdown
            const responseData = response.data?.data || [];
            const total = response.data?.total || 0; // Still get total for pagination display if needed
            const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0;
            let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;

            if (!appointmentRowsPerPageOptions.includes(perPage)) {
                // console.warn(`API returned per_page=${perPage} not in options for appointments. Defaulting to ${limit} or ${appointmentRowsPerPageOptions[0]}`);
                perPage = appointmentRowsPerPageOptions.includes(limit) ? limit : appointmentRowsPerPageOptions[0]; // Default to 5
            }

            setAppointments(responseData); // This state will now hold all appointments for the dropdown
            setAppointmentTotalRows(total); // Keep total for pagination if displaying a table elsewhere
            setAppointmentPage(currentPage); // Keep page for pagination if displaying a table elsewhere
            setAppointmentRowsPerPage(perPage); // Keep rows per page for pagination if displaying a table elsewhere
        } catch (err) {
            console.error("Failed to fetch appointments:", err);
            setError(prev => ({ ...prev, appointments: 'Failed to fetch appointments.' }));
            toast.error('Failed to load appointments.');
            setAppointments([]);
            setAppointmentTotalRows(0);
        } finally {
            setLoading(prev => ({ ...prev, appointments: false }));
        }
    }, [appointmentRowsPerPageOptions]); // Dependency array for useCallback

    const fetchQuotes = useCallback(async (page = 0, limit = 10, search = '') => {
        setLoading(prev => ({ ...prev, quotes: true }));
        setError(prev => ({ ...prev, quotes: null }));
        try {
            const apiPage = page + 1;
            // Ensure the API returns 'comment' and 'filename'/'file_path' fields for each quote
            const response = await apiClient.get(`/superviseur/quotes?page=${apiPage}&limit=${limit}&search=${search}`);
            const responseData = response.data?.data || [];
            const total = response.data?.total || 0;
            const currentPage = response.data?.current_page ? response.data.current_page - 1 : 0;
            let perPage = response.data?.per_page ? Number(response.data.per_page) : limit;

            if (!quoteRowsPerPageOptions.includes(perPage)) {
                console.warn(`API returned per_page=${perPage} not in options for quotes. Defaulting to ${limit} or ${quoteRowsPerPageOptions[0]}`);
                perPage = quoteRowsPerPageOptions.includes(limit) ? limit : quoteRowsPerPageOptions[0]; // Default to 5
            }

            setQuotes(responseData); // responseData should now contain quote objects including comment and filename/file_path
            setQuoteTotalRows(total);
            setQuotePage(currentPage);
            setQuoteRowsPerPage(perPage);
        } catch (err) {
            console.error("Failed to fetch quotes:", err);
            setError(prev => ({ ...prev, quotes: 'Failed to fetch quotes.' }));
            toast.error('Failed to load quotes.');
            setQuotes([]);
            setQuoteTotalRows(0);
        } finally {
            setLoading(prev => ({ ...prev, quotes: false }));
        }
    }, [quoteRowsPerPageOptions]); // Dependency array for useCallback

    // Fetch Statistics
    const fetchStatistics = useCallback(async (month, year) => {
        setLoading(prev => ({ ...prev, stats: true }));
        setError(prev => ({ ...prev, stats: null }));
        try {
            const response = await apiClient.get(`/superviseur/statistics?month=${month}&year=${year}`);
            // Basic validation of the expected structure
            if (response.data && Array.isArray(response.data.labels) && Array.isArray(response.data.datasets)) {
                setStatistics(response.data);
            } else {
                console.warn("Statistics API response format is unexpected. Expected { labels: [], datasets: [] }", response.data);
                setError(prev => ({ ...prev, stats: 'Statistics data format is incorrect.' }));
                setStatistics(null); // Clear potentially bad data
                toast.warn("Received unexpected statistics format from server.");
            }
        } catch (err) {
            console.error("Failed to fetch statistics:", err);
            const status = err.response?.status;
            if (status === 500) {
                setError(prev => ({ ...prev, stats: 'Failed to fetch statistics (Server Error). Please check backend logs.' }));
                toast.error("Statistics server error. Check backend.");
            } else if (status === 404) {
                setError(prev => ({ ...prev, stats: 'Statistics endpoint not found.' }));
                toast.error("Statistics endpoint not found (404).");
            } else {
                setError(prev => ({ ...prev, stats: `Failed to fetch statistics (${status || 'Network Error'}).` }));
                toast.error("Could not load statistics.");
            }
            setStatistics(null); // Clear stats on error
        } finally {
            setLoading(prev => ({ ...prev, stats: false }));
        }
    }, []); // Dependencies: none

    // --- Debounce Hooks (Now placed AFTER fetchUsers/fetchQuotes) ---

    // Debounce user search input - **UPDATED to include role filter**
    useDebounce(() => {
        setDebouncedUserSearch(userSearch); // Update debounced value first
        // Fetch with the latest search term AND role filter, reset page to 0
        fetchUsers(0, userRowsPerPage, userSearch, selectedRoleFilter);
    }, 500, [userSearch, userRowsPerPage, selectedRoleFilter, fetchUsers]); // Add selectedRoleFilter dependency

    // Debounce quote search input
    useDebounce(() => {
        setDebouncedQuoteSearch(quoteSearch); // Update debounced value first
        fetchQuotes(0, quoteRowsPerPage, quoteSearch); // Fetch with the latest search term
    }, 500, [quoteSearch, quoteRowsPerPage, fetchQuotes]);

    // --- Authorization and Initial Data Fetch ---

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const response = await apiClient.get('/user'); // Endpoint to get current user info
                const isSupervisor = response.data?.roles?.some(role => role.name === 'superviseur');

                if (isSupervisor) {
                    setUserRole('superviseur');
                    // Initial fetch for all data sections using debounced values or initial state
                    // **Pass initial role filter state here**
                    fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
                    fetchAppointments(appointmentPage, appointmentRowsPerPage); // Fetch appointments for dropdown
                    fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch); // Fetch quotes for table and dropdown logic
                    fetchStatistics(statsMonth, statsYear);
                } else {
                    setError(prev => ({ ...prev, general: 'Access Denied: Admin role required.' }));
                    handleLogout(); // Logout if not admin
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                if (err.response?.status === 401) {
                    setError(prev => ({ ...prev, general: 'Session expired. Please login again.' }));
                    toast.error('Session expired. Please login again.');
                } else {
                    setError(prev => ({ ...prev, general: 'Authentication failed. Please login again.' }));
                    toast.error('Authentication failed.');
                }
                handleLogout(); // Logout on auth error
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Only run on mount/navigate change

    // Effect to refetch statistics when month/year changes AND user is admin
    useEffect(() => {
        // Only fetch if the role is confirmed and month/year are set
        if (userRole === 'administrateur' && statsMonth && statsYear) {
            fetchStatistics(statsMonth, statsYear);
        }
    }, [statsMonth, statsYear, userRole, fetchStatistics]); // Dependencies are correct

    // **NEW Effect to refetch users when role filter changes**
    useEffect(() => {
        // Only refetch if the user role is admin (initial fetch handles other cases)
        // And avoid refetching during the initial debounce setup for search
        if (userRole === 'administrateur' && !loading.auth) {
            // Fetch users with the new role filter, reset page to 0
            fetchUsers(0, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRoleFilter, userRole]); // Trigger only when role filter or userRole changes

    // --- CRUD Handlers ---

    const handleSaveUser = async () => {
        const isEditing = !!currentUser;
        // Ensure password is only included if it's set (for edit) or required (for create)
        const userData = isEditing
            ? { ...currentUser, password: currentUser.password || undefined } // Send undefined if empty, API should ignore
            : newUser;

        // Basic validation
        if (!userData.name || !userData.last_name || !userData.email || !userData.role) {
            setError(prev => ({ ...prev, general: "Please fill in all required fields." }));
            toast.warn("Please fill in all required fields.");
            return;
        }
        // Password length validation only for new users or if password is changed for existing user
        if (userData.password && userData.password.length < 8) {
            setError(prev => ({ ...prev, general: "Password must be at least 8 characters long." }));
            toast.warn("Password must be at least 8 characters long.");
            return;
        }

        setError(prev => ({ ...prev, general: null })); // Clear previous errors
        const url = isEditing ? `/superviseur/users/${currentUser.id}` : '/superviseur/users';
        const method = isEditing ? 'put' : 'post';

        try {
            const response = await apiClient[method](url, userData, {
                headers: { 'Content-Type': 'application/json' }
            });
            closeUserDialog();
            // Refetch users based on current pagination, search, and role filter state
            fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
            toast.success(`User "${response.data.name}" ${isEditing ? 'updated' : 'created'} successfully.`);
        } catch (err) {
            console.error(`Failed to ${isEditing ? 'update' : 'create'} user:`, err.response?.data);
            const errors = err.response?.data?.errors;
            let errorMsg = `Failed to ${isEditing ? 'update' : 'create'} user.`;
            if (errors) {
                // Concatenate validation errors
                errorMsg += " " + Object.values(errors).flat().join(' ');
            } else {
                errorMsg += " " + (err.response?.data?.message || 'Please check details and try again.');
            }
            setError(prev => ({ ...prev, general: errorMsg })); // Show error in dialog
            toast.error(errorMsg);
        }
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await apiClient.delete(`/superviseur/users/${userToDelete.id}`);
            closeDeleteDialog();
            // Adjust page if the last item on the current page was deleted
            const newTotal = userTotalRows - 1;
            const newTotalPages = Math.ceil(newTotal / userRowsPerPage);
            const newPage = (userPage >= newTotalPages && newTotalPages > 0) ? newTotalPages - 1 : userPage;

            // Fetch users for the potentially adjusted page, keeping filters
            fetchUsers(newPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
            toast.success(`User "${userToDelete.name}" deleted successfully.`);
        } catch (err) {
            console.error("Failed to delete user:", err);
            const errorMsg = `Failed to delete user "${userToDelete.name}". ` + (err.response?.data?.message || '');
            // Show error in the delete dialog or as a general alert if dialog closes immediately
            setError(prev => ({ ...prev, general: errorMsg }));
            toast.error(errorMsg);
        } finally {
            setUserToDelete(null); // Clear user to delete state
        }
    };

    const toggleUserStatus = async (userId) => {
        try {
            const response = await apiClient.post(`/superviseur/users/${userId}/toggle-status`);
            const isActive = response.data?.is_active; // Assuming API returns the new status
            toast.success(`User account ${isActive ? 'activated' : 'deactivated'}.`);
            // Refetch users to reflect the status change, keeping filters
            fetchUsers(userPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
        } catch (err) {
            console.error("Failed to toggle user status:", err);
            toast.error("Failed to update user status. " + (err.response?.data?.message || ''));
        }
    };

    // Function to view/download patient files (assuming PDF for now)
    const viewPatientFiles = async (userId) => {
        try {
            // 1. Get list of files for the patient
            const responseFiles = await apiClient.get(`/superviseur/users/${userId}/patient-files`);
            const files = responseFiles.data; // Assuming API returns an array of file objects { id: ..., file_name: ... }

            if (!files || files.length === 0) {
                toast.info('This patient has not uploaded any files.');
                return;
            }

            // For simplicity, download the first file found. Could be extended to show a list.
            const firstFile = files[0];
            const fileId = firstFile.id;
            const fileName = firstFile.file_name || `medical_file_${fileId}.pdf`; // Fallback filename

            // 2. Download the specific file
            const token = localStorage.getItem('token');
            const responseBlob = await fetch(`${apiClient.defaults.baseURL}/superviseur/files/${fileId}/download`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/pdf', // Request PDF content type
                }
            });

            if (!responseBlob.ok) {
                // Handle download errors (e.g., file not found, permission denied)
                const errorData = await responseBlob.text(); // Try to get error message
                console.error("Download failed:", responseBlob.status, errorData);
                throw new Error(`Download failed with status ${responseBlob.status}.`);
            }

            // 3. Create a blob URL and trigger download
            const blob = await responseBlob.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName; // Use the filename from the API or the fallback
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl); // Clean up the blob URL

        } catch (err) {
            console.error("Failed to fetch or download patient files:", err);
            toast.error("Failed to download patient file. " + (err.message || ''));
        }
    };

    // --- Quote File Upload Handler (Used for updating existing quotes) ---
    const handleUploadQuoteFile = async (quoteId, file) => {
        if (!file) {
            toast.info("No file selected.");
            return;
        }
        if (file.type !== "application/pdf") {
            toast.warn("Please select a PDF file.");
            return;
        }
        // Frontend file size check (matches backend limit)
        const maxSize = 20 * 1024 * 1024; // 20MB in bytes
        if (file.size > maxSize) {
            toast.error(`File size exceeds the limit of 20MB.`);
            return; // Stop the upload attempt
        }

        const formData = new FormData();
        formData.append('file', file);

        // Show loading feedback (optional)
        const toastId = toast.loading("Uploading PDF...");

        try {
            // Use the correct endpoint for uploading a quote file
            await apiClient.post(`/superviseur/quotes/${quoteId}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            toast.update(toastId, { render: "PDF uploaded successfully!", type: "success", isLoading: false, autoClose: 3000 });
            // Refetch quotes to show the updated file status/link
            fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
        } catch (err) {
            console.error('Upload failed:', err.response?.data || err.message);
            let errorMsg = 'Failed to upload PDF.';
            if (err.response?.data?.message) {
                errorMsg += ` ${err.response.data.message}`;
            } else if (err.response?.status === 413) { // Payload Too Large
                errorMsg = 'File is too large (Max: 20MB).';
            } else if (err.response?.status === 422) { // Validation Errors
                errorMsg = 'Upload validation failed.';
                if (err.response.data.errors?.file) {
                    errorMsg += ` ${err.response.data.errors.file.join(' ')}`;
                }
            } else {
                errorMsg += ' Please try again.';
            }
            toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 5000 });
        }
    };

    // Handle Creating a New Quote
    const handleCreateQuote = async () => {
        const { appointment_id, file } = newQuote; // Get data from state

        // Basic validation
        if (!appointment_id || !file) {
            toast.warn("Please select an appointment and a PDF file.");
            return;
        }
        // Check file type and size again before sending
        if (file.type !== "application/pdf") {
            toast.warn("Please select a PDF file.");
            return;
        }
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
            toast.error(`File size exceeds the limit of 20MB.`);
            return;
        }

        // Create FormData to send file and appointment ID
        const formData = new FormData();
        formData.append("appointment_id", appointment_id);
        formData.append("file", file);

        const toastId = toast.loading("Creating quote..."); // Loading indicator

        try {
            // Make POST request to the create quote endpoint
            await apiClient.post("/superviseur/quotes", formData, {
                headers: {
                    // Axios usually sets multipart/form-data automatically when FormData is used
                    // 'Content-Type': 'multipart/form-data', // Explicitly setting might be needed in some cases
                },
            });
            toast.update(toastId, { render: "Quote added successfully!", type: "success", isLoading: false, autoClose: 3000 });
            setIsQuoteDialogOpen(false); // Close the dialog
            setNewQuote({ appointment_id: '', file: null }); // Reset the form state
            // Refetch quotes to update the table, using current pagination/search settings
            fetchQuotes(quotePage, quoteRowsPerPage, debouncedQuoteSearch);
            // Also refetch appointments in case the newly quoted one needs to be disabled in the dropdown
            fetchAppointments(appointmentPage, appointmentRowsPerPage);
        } catch (err) {
            console.error("Failed to create quote:", err.response?.data || err.message);
            let errorMsg = "Failed to create quote."; // Default error message

            // Check for specific backend error messages first
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message; // Use backend message directly if available
            }
            // Handle specific status codes if no detailed message is present
            else if (err.response?.status === 413) {
                errorMsg = 'File is too large (Max: 20MB).';
            }
            // Handle validation errors (422)
            else if (err.response?.status === 422) {
                errorMsg = 'Validation failed.'; // General validation message
                // Append specific field errors if available
                if (err.response.data.errors?.file) {
                    errorMsg += ` File: ${err.response.data.errors.file.join(' ')}`;
                }
                if (err.response.data.errors?.appointment_id) {
                    errorMsg += ` Appointment: ${err.response.data.errors.appointment_id.join(' ')}`;
                }
                // Check for "already exists" specifically within 422 errors (if not caught by message check above)
                if (err.response.data?.message?.includes("already exists")) {
                    errorMsg = err.response.data.message; // Override with the specific duplicate message
                } else if (err.response.data?.errors?.appointment_id?.some(msg => msg.includes("already exists"))) {
                    // Alternative check if the error is nested under appointment_id
                    errorMsg = err.response.data.errors.appointment_id.find(msg => msg.includes("already exists")) || "A quote for this appointment already exists.";
                }
            }

            // Update the toast notification with the determined error message
            toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 5000 });

            // Optionally keep the dialog open on error:
            // setIsQuoteDialogOpen(true);
        }
    };


    const { logout } = useContext(AuthContext); // 👈 from AuthContext

    const handleLogout = () => {
        logout(); // this handles everything (removing token, context, redirect, etc.)
    };

    // --- Dialog Management ---

    const openUserDialog = (user = null) => {
        setError(prev => ({ ...prev, general: null })); // Clear general errors when opening dialog
        if (user) {
            // Extract role name correctly, handle cases where roles array might be empty or missing
            const roleName = user.roles?.length > 0 ? user.roles[0].name : (user.role || ''); // Fallback to user.role if roles array is missing/empty
            setCurrentUser({ ...user, password: '', role: roleName }); // Set password to empty for edit form
            setNewUser({ name: '', last_name: '', email: '', password: '', role: '' }); // Clear newUser state
        } else {
            setNewUser({ name: '', last_name: '', email: '', password: '', role: '' }); // Reset newUser form
            setCurrentUser(null); // Clear currentUser state
        }
        setIsUserDialogOpen(true);
    };

    const closeUserDialog = () => {
        setIsUserDialogOpen(false);
        setCurrentUser(null);
        setNewUser({ name: '', last_name: '', email: '', password: '', role: '' });
        setError(prev => ({ ...prev, general: null })); // Clear general errors on close
    };

    const openDeleteDialog = (user) => {
        // Store minimal info needed for deletion confirmation message
        setUserToDelete({ id: user.id, name: `${user.name} ${user.last_name}` });
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
        setError(prev => ({ ...prev, general: null })); // Clear general errors on close
    };

    // --- MUI TablePagination Handlers ---

    const handleChangeUserPage = (event, newPage) => {
        // setUserPage(newPage); // Let fetchUsers update the page state
        fetchUsers(newPage, userRowsPerPage, debouncedUserSearch, selectedRoleFilter);
    };

    const handleChangeUserRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        // setUserRowsPerPage(newLimit); // Let fetchUsers update the rowsPerPage state
        // setUserPage(0); // Reset to first page when changing rows per page
        fetchUsers(0, newLimit, debouncedUserSearch, selectedRoleFilter); // Fetch page 0 with new limit and current filters
    };

    const handleChangeAppointmentPage = (event, newPage) => {
        // setAppointmentPage(newPage);
        // This pagination might not be needed if appointments are only for the dropdown
        // fetchAppointments(newPage, appointmentRowsPerPage);
        console.log("Appointment page changed (if table exists):", newPage);
    };

    const handleChangeAppointmentRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        // setAppointmentRowsPerPage(newLimit);
        // setAppointmentPage(0);
        // This pagination might not be needed if appointments are only for the dropdown
        // fetchAppointments(0, newLimit);
        console.log("Appointment rows per page changed (if table exists):", newLimit);
    };

    const handleChangeQuotePage = (event, newPage) => {
        // setQuotePage(newPage);
        fetchQuotes(newPage, quoteRowsPerPage, debouncedQuoteSearch);
    };

    const handleChangeQuoteRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        // setQuoteRowsPerPage(newLimit);
        // setQuotePage(0);
        fetchQuotes(0, newLimit, debouncedQuoteSearch);
    };

    // --- Memoized Chart Data ---

    const chartData = useMemo(() => {
        // Ensure statistics and its properties are valid before processing
        if (!statistics || !Array.isArray(statistics.labels) || !Array.isArray(statistics.datasets)) {
            return [];
        }
        // Filter out potentially invalid datasets (e.g., missing label or data array)
        const validDatasets = statistics.datasets.filter(ds => ds && ds.label && Array.isArray(ds.data));

        // Handle case where there are labels but no valid datasets (e.g., API returned empty datasets)
        if (validDatasets.length === 0 && statistics.labels.length > 0) {
            // Return labels only, so XAxis shows days, but no bars appear
            return statistics.labels.map(dayLabel => ({ day: dayLabel }));
        }

        // Map labels to data points, including data from each valid dataset
        return statistics.labels.map((dayLabel, index) => {
            const dataPoint = { day: dayLabel }; // X-axis key
            validDatasets.forEach(dataset => {
                // Assign data for each dataset label, default to 0 if data is missing for this index
                dataPoint[dataset.label] = dataset.data[index] ?? 0;
            });
            return dataPoint;
        });
    }, [statistics]); // Dependency: only recompute when statistics data changes

    // Define colors for the chart bars
    const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1', '#ffbb28', '#00C49F'];

    // --- Set Active Section ---
    const setSection = (section) => {
        setActiveSection(section);
        setSidebarOpen(false); // Close sidebar when a section is selected
    };

    // --- Render Logic ---

    // Loading state during initial authentication check
    if (loading.auth) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Verifying Authentication...</Typography>
            </Box>
        );
    }

    // If authentication failed or user is not an admin (and not loading anymore)
    if (!userRole && !loading.auth) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error">{error.general || 'Access Denied. Administrator role required.'}</Alert>
                <Button variant="outlined" onClick={() => navigate('/login')} sx={{ mt: 2 }}>Go to Login</Button>
            </Container>
        );
    }

    // Main Dashboard Layout
    return (
        <Box sx={{ display: 'flex', height: '100vh' }}> {/* Use flex display for sidebar layout */}
            <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
            {/* AppBar */}
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}> {/* Ensure AppBar is above Drawer */}
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={() => setSidebarOpen(!sidebarOpen)} // Toggle sidebar
                        sx={{ mr: 2 }} // Add margin to the right of the icon
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Supervisor Dashboard
                    </Typography>
                    <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>Logout</Button>
                </Toolbar>
            </AppBar>

            {/* Sidebar Drawer */}
            <Drawer
                variant="persistent" // Or 'temporary' if you prefer it to overlay content
                anchor="left"
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)} // Allow closing temporary drawer by clicking outside
                sx={{
                    width: 240,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { // Style the paper inside the drawer
                        width: 240,
                        boxSizing: 'border-box',
                        // backgroundColor: 'primary.main', // Example styling
                        // color: 'primary.contrastText', // Example styling
                        top: '64px', // Position below AppBar (adjust if AppBar height changes)
                        height: 'calc(100% - 64px)',
                    },
                }}
            >
                <Toolbar /> {/* Add Toolbar space to align content below AppBar */}
                <Box sx={{ overflow: 'auto' }}>
                    <List>
                        <ListItem button selected={activeSection === 'statistics'} onClick={() => setSection('statistics')}>
                            <ListItemIcon> <BarChartIcon /> </ListItemIcon>
                            <ListItemText primary="Statistics" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'users'} onClick={() => setSection('users')}>
                            <ListItemIcon> <PeopleIcon /> </ListItemIcon>
                            <ListItemText primary="User Management" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'appointments'} onClick={() => setSection('appointments')}>
                            <ListItemIcon> <EventIcon /> </ListItemIcon>
                            <ListItemText primary="Appointments" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'quotes'} onClick={() => setSection('quotes')}>
                            <ListItemIcon> <RequestQuoteIcon /> </ListItemIcon>
                            <ListItemText primary="Quotes" />
                        </ListItem>
                    </List>
                </Box>
            </Drawer>

            {/* Main Content Area */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    mt: '64px', // AppBar height
                    height: 'calc(100vh - 64px)', // Full height minus AppBar
                    overflow: 'auto', // Allow scrolling within content area
                    transition: (theme) => theme.transitions.create('margin', { // Smooth transition for margin shift
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    marginLeft: sidebarOpen ? `240px` : 0, // Shift content when drawer is open
                }}
            >
                {/* General Error Alert (only shown if no dialogs are open) */}
                {error.general && !isUserDialogOpen && !isDeleteDialogOpen && !isQuoteDialogOpen &&
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(prev => ({ ...prev, general: null }))}>
                        {error.general}
                    </Alert>
                }

                {/* --- Statistics Section --- */}
                {activeSection === 'statistics' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader
                            title="Platform Statistics"
                            subheader={statsMonth && statsYear ? `Appointments per Day per Agent for ${String(statsMonth).padStart(2, '0')}/${statsYear}` : 'Select month and year'}
                        />
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                                {/* Month Selector */}
                                <FormControl sx={{ minWidth: 150 }} size="small">
                                    <InputLabel id="stats-month-label">Month</InputLabel>
                                    <Select
                                        labelId="stats-month-label"
                                        value={statsMonth}
                                        label="Month"
                                        onChange={(e) => setStatsMonth(e.target.value)}
                                        disabled={loading.stats}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <MenuItem key={m} value={String(m)}>
                                                {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {/* Year Selector */}
                                <FormControl sx={{ minWidth: 120 }} size="small">
                                    <InputLabel id="stats-year-label">Year</InputLabel>
                                    <Select
                                        labelId="stats-year-label"
                                        value={statsYear}
                                        label="Year"
                                        onChange={(e) => setStatsYear(e.target.value)}
                                        disabled={loading.stats}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                            <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {loading.stats && <CircularProgress size={24} sx={{ ml: 2 }} />}
                            </Box>
                            {/* Chart Area */}
                            <Box sx={{ flexGrow: 1, minHeight: 300 }}> {/* Ensure chart area can grow */}
                                {loading.stats ? (
                                    <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />
                                ) : statistics && chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="day" />
                                            <YAxis allowDecimals={false} />
                                            <RechartsTooltip />
                                            <Legend />
                                            {/* Render bars for each valid dataset */}
                                            {statistics.datasets
                                                .filter(ds => ds && ds.label && Array.isArray(ds.data))
                                                .map((dataset, idx) => (
                                                    <Bar key={dataset.label || idx} dataKey={dataset.label} fill={chartColors[idx % chartColors.length]} />
                                                ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : error.stats ? (
                                    <Alert severity="warning">{error.stats}</Alert>
                                ) : (
                                    <Typography sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
                                        No appointment data available for the selected period.
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* --- User Management Section --- */}
                {activeSection === 'users' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader
                            title="User Management"
                            action={
                                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openUserDialog()}>
                                    Add User
                                </Button>
                            }
                        />
                        <CardContent sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}> {/* Allow content to grow and hide overflow */}
                            {/* Filter Controls Box */}
                            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                                <TextField
                                    label="Search Users (Name or Email)"
                                    variant="outlined"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    sx={{ flexGrow: 1, minWidth: 200 }} // Allow search to grow
                                    size="small"
                                    disabled={loading.users}
                                />
                                {/* **NEW** Role Filter Dropdown */}
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel id="role-filter-label">Filter by Role</InputLabel>
                                    <Select
                                        labelId="role-filter-label"
                                        value={selectedRoleFilter}
                                        onChange={(e) => setSelectedRoleFilter(e.target.value)} // Update state on change
                                        label="Filter by Role"
                                        disabled={loading.users}
                                    >
                                        <MenuItem value=""><em>All Roles</em></MenuItem>
                                        {/* Use the globally defined roles array */}
                                        {roles.map(role => (
                                            <MenuItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            {error.users && <Alert severity="warning" sx={{ mb: 2, flexShrink: 0 }}>{error.users}</Alert>}
                            {/* Table Container with fixed height */}
                            <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}> {/* Table takes remaining space */}
                                <Table stickyHeader sx={{ minWidth: 650 }} aria-label="user table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Role(s)</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading.users ? (
                                            // Skeleton rows
                                            Array.from(new Array(userRowsPerPage)).map((_, index) => (
                                                <TableRow key={`skel-user-${index}`}>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell align="right">
                                                        <Skeleton variant="circular" width={24} height={24} sx={{ display: 'inline-block', mr: 0.5 }} />
                                                        <Skeleton variant="circular" width={24} height={24} sx={{ display: 'inline-block', mr: 0.5 }} />
                                                        <Skeleton variant="rectangular" width={70} height={24} sx={{ display: 'inline-block', borderRadius: 1, ml: 0.5 }} />
                                                        <Skeleton variant="rectangular" width={80} height={24} sx={{ display: 'inline-block', borderRadius: 1, ml: 0.5 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : users.length > 0 ? users.map((user) => ( // Map over the 'users' state (already filtered by backend)
                                            // Actual user rows
                                            <TableRow hover key={user.id}>
                                                <TableCell component="th" scope="row">{user.name} {user.last_name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.roles?.map(r => r.name).join(', ') || user.role || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Box component="span" sx={{ color: user.is_active ? 'success.main' : 'error.main', fontWeight: 'medium' }}>
                                                        {user.is_active ? 'Active' : 'Inactive'}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {/* Edit Button */}
                                                    <Tooltip title="Edit User" arrow>
                                                        <IconButton size="small" onClick={() => openUserDialog(user)} aria-label="edit user">
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {/* Delete Button */}
                                                    <Tooltip title="Delete User" arrow>
                                                        <IconButton size="small" onClick={() => openDeleteDialog(user)} color="error" aria-label="delete user">
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {/* Enable/Disable Button */}
                                                    <Tooltip title={user.is_active ? 'Deactivate User' : 'Activate User'} arrow>
                                                        <Button
                                                            size="small"
                                                            onClick={() => toggleUserStatus(user.id)}
                                                            color={user.is_active ? 'warning' : 'success'}
                                                            sx={{ ml: 1, mr: 0.5, minWidth: '70px' }}
                                                            variant="outlined"
                                                        >
                                                            {user.is_active ? 'Disable' : 'Enable'}
                                                        </Button>
                                                    </Tooltip>
                                                    {/* View Patient PDFs Button (Conditional) */}
                                                    {user.roles?.some(r => r.name === 'patient') && (
                                                        <Tooltip title="View Patient Uploaded Files" arrow>
                                                            <Button
                                                                size="small"
                                                                onClick={() => viewPatientFiles(user.id)}
                                                                sx={{ ml: 0.5 }}
                                                                variant="text"
                                                            >
                                                                View PDFs
                                                            </Button>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            // No users found row
                                            <TableRow><TableCell colSpan={5} align="center">No users found matching the criteria.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {/* Pagination */}
                            <TablePagination
                                rowsPerPageOptions={userRowsPerPageOptions}
                                component="div"
                                count={userTotalRows}
                                rowsPerPage={userRowsPerPage}
                                page={userPage}
                                onPageChange={handleChangeUserPage}
                                onRowsPerPageChange={handleChangeUserRowsPerPage}
                                sx={{ flexShrink: 0 }} // Prevent pagination from shrinking
                            />
                        </CardContent>
                    </Card>
                )}

                {/* --- Appointments Section --- */}
                {/* Note: This section might only be needed if you display appointments in a table */}
                {/* If only needed for the dropdown, you might hide this section */}
                {activeSection === 'appointments' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader title="Recent Appointments (Table View)" />
                        <CardContent sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {error.appointments && <Alert severity="warning" sx={{ mb: 2, flexShrink: 0 }}>{error.appointments}</Alert>}
                            <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
                                <Table stickyHeader size="small" aria-label="recent appointments table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Prospect</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading.appointments ? (
                                            // Use the correct rows per page for skeleton
                                            Array.from(new Array(appointmentRowsPerPage)).map((_, index) => (
                                                <TableRow key={`skel-appt-${index}`}><TableCell colSpan={3}><Skeleton animation="wave" /></TableCell></TableRow>
                                            ))
                                        ) : appointments.length > 0 ? appointments.map(appt => ( // Map over the full appointments list
                                            <TableRow hover key={appt.id}>
                                                <TableCell>{appt.prenom_du_prospect} {appt.nom_du_prospect}</TableCell>
                                                <TableCell>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleDateString() : 'N/A'}</TableCell>
                                                <TableCell>
                                                    {/* Display the status */}
                                                    {appt.status || 'N/A'}

                                                    {/* Conditionally display the Link if clinic_quote_url exists */}
                                                    {appt.clinic_quote_url && (
                                                        <Box sx={{ mt: 0.5 }}> {/* Add a little space above the link */}
                                                            <Link
                                                                href={appt.clinic_quote_url} // Use the URL from the appointment data
                                                                target="_blank"             // Open in a new tab
                                                                rel="noopener noreferrer"   // Security measure for target="_blank"
                                                                variant="body2"             // Use a smaller text style
                                                                sx={{
                                                                    fontSize: '0.85em',     // Further reduce font size slightly
                                                                    fontWeight: 'medium',
                                                                    display: 'inline-block', // Prevents taking full width
                                                                    // Optional: Add specific color if needed, e.g., color: 'primary.main'
                                                                }}
                                                            >
                                                                View Clinic Quote
                                                            </Link>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={3} align="center">No recent appointments.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {/* Pagination for the appointments table (if shown) */}
                            {/* <TablePagination
                                rowsPerPageOptions={appointmentRowsPerPageOptions}
                                component="div"
                                count={appointmentTotalRows}
                                rowsPerPage={appointmentRowsPerPage}
                                page={appointmentPage}
                                onPageChange={handleChangeAppointmentPage}
                                onRowsPerPageChange={handleChangeAppointmentRowsPerPage}
                                sx={{ flexShrink: 0 }}
                            /> */}
                            <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                                Note: Appointments list might show more entries than pagination suggests, as it fetches all for the quote dropdown.
                            </Typography>
                        </CardContent>
                    </Card>
                )}

                {/* --- Quotes Section --- */}
                {activeSection === 'quotes' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Add Button to Card Header */}
                        <CardHeader
                            title="Recent Quotes"
                            action={
                                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsQuoteDialogOpen(true)}>
                                    Add Quote
                                </Button>
                            }
                        />
                        <CardContent sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <TextField
                                label="Search Quotes (Prospect Name/ID)"
                                variant="outlined"
                                fullWidth
                                value={quoteSearch}
                                onChange={(e) => setQuoteSearch(e.target.value)}
                                sx={{ mb: 2, flexShrink: 0 }}
                                size="small"
                                disabled={loading.quotes}
                            />
                            {error.quotes && <Alert severity="warning" sx={{ mb: 2, flexShrink: 0 }}>{error.quotes}</Alert>}
                            <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
                                <Table stickyHeader size="small" aria-label="recent quotes table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>ID</TableCell>
                                            <TableCell>Prospect (Appt)</TableCell>
                                            <TableCell>PDF Contains Amount</TableCell> {/* Header already renamed */}
                                            <TableCell>Status</TableCell>
                                            <TableCell>Comment</TableCell>
                                            <TableCell align="center">PDF</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading.quotes ? (
                                            Array.from(new Array(quoteRowsPerPage)).map((_, index) => (
                                                <TableRow key={`skel-quote-${index}`}>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                                    <TableCell align="center"><Skeleton variant="rectangular" width={80} height={24} animation="wave" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : quotes.length > 0 ? quotes.map(quote => (
                                            <TableRow hover key={quote.id}>
                                                <TableCell>{quote.id}</TableCell>
                                                {/* Prospect Display */}
                                                <TableCell>
                                                    {quote.appointment
                                                        ? `${quote.appointment.prenom_du_prospect || ''} ${quote.appointment.nom_du_prospect || ''}`.trim()
                                                        : <Typography variant="caption" color="textSecondary">No Appointment</Typography>}
                                                </TableCell>
                                                {/* Amount Column Display */}
                                                <TableCell>
                                                    {(quote.file_path || quote.filename) // Check if either file_path or filename exists
                                                        ? <Typography variant="body2" color="textSecondary">See PDF</Typography>
                                                        : <Typography variant="caption" color="textSecondary">No file</Typography>}
                                                </TableCell>
                                                <TableCell>{quote.status || 'N/A'}</TableCell>
                                                {/* Comment Cell with Tooltip */}
                                                <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {quote.status === 'refused' ? ( // Only show comment if status is refused
                                                        quote.comment ? (
                                                            <Tooltip title={quote.comment} arrow>
                                                                <span>{quote.comment}</span>
                                                            </Tooltip>
                                                        ) : (
                                                            <Typography variant="caption" color="textSecondary">No comment</Typography>
                                                        )
                                                    ) : (
                                                        '-' // Show dash if status is not refused
                                                    )}
                                                </TableCell>
                                                {/* PDF Download/Upload Cell */}
                                                <TableCell align="center">
                                                    {(quote.file_path || quote.filename) ? (
                                                        // Download Button if file exists
                                                        <Tooltip title={`Download PDF (${quote.filename || 'Quote'})`} arrow>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={async () => {
                                                                    try {
                                                                        const token = localStorage.getItem('token');
                                                                        // Ensure baseURL doesn't have trailing slash if endpoint starts with one
                                                                        const downloadEndpoint = `${apiClient.defaults.baseURL}/superviseur/quotes/${quote.id}/download`;
                                                                        const response = await fetch(downloadEndpoint, {
                                                                            method: 'GET',
                                                                            headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }
                                                                        });
                                                                        if (!response.ok) {
                                                                            const errorText = await response.text(); // Get error details
                                                                            console.error('Download failed:', response.status, errorText);
                                                                            throw new Error(`Download failed (${response.status}).`);
                                                                        }
                                                                        const blob = await response.blob();
                                                                        const downloadUrl = window.URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = downloadUrl;
                                                                        a.download = quote.filename || `quote_${quote.id}.pdf`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                        window.URL.revokeObjectURL(downloadUrl);
                                                                    } catch (err) {
                                                                        console.error('Error downloading PDF:', err);
                                                                        toast.error(`Could not download PDF. ${err.message}`);
                                                                    }
                                                                }}
                                                                sx={{ minWidth: '90px' }}
                                                            >
                                                                Download
                                                            </Button>
                                                        </Tooltip>
                                                    ) : (
                                                        // Upload Button if no file exists (for updating existing quote's file)
                                                        <Tooltip title="Upload Quote PDF" arrow>
                                                            <Button
                                                                size="small"
                                                                variant="text" // Use text variant for upload trigger
                                                                component="label" // Make button act as a label for the hidden input
                                                                sx={{ minWidth: '90px' }}
                                                            >
                                                                Upload
                                                                <Typography variant="caption" color="textSecondary" sx={{ ml: 0.5, display: 'inline' }}>
                                                                    (Max: 20MB)
                                                                </Typography>
                                                                <input
                                                                    type="file"
                                                                    hidden
                                                                    accept="application/pdf"
                                                                    // Clear value on click to allow re-uploading the same file
                                                                    onClick={(e) => { e.target.value = ''; }}
                                                                    onChange={(e) => handleUploadQuoteFile(quote.id, e.target.files?.[0])}
                                                                />
                                                            </Button>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={6} align="center">No recent quotes found.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                rowsPerPageOptions={quoteRowsPerPageOptions}
                                component="div"
                                count={quoteTotalRows}
                                rowsPerPage={quoteRowsPerPage}
                                page={quotePage}
                                onPageChange={handleChangeQuotePage}
                                onRowsPerPageChange={handleChangeQuoteRowsPerPage}
                                sx={{ flexShrink: 0 }}
                            />
                        </CardContent>
                    </Card>
                )}
            </Box>

            {/* --- Dialogs --- */}

            {/* User Create/Edit Dialog */}
            <Dialog open={isUserDialogOpen} onClose={closeUserDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{currentUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                <DialogContent>
                    {/* Show general errors specific to the dialog */}
                    {error.general && isUserDialogOpen && <Alert severity="error" sx={{ mb: 1 }}>{error.general}</Alert>}
                    <Box component="form" noValidate autoComplete="off" sx={{ mt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField required fullWidth margin="dense" id="name" label="First Name" name="name" value={currentUser ? currentUser.name : newUser.name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })} autoFocus />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField required fullWidth margin="dense" id="last_name" label="Last Name" name="last_name" value={currentUser ? currentUser.last_name : newUser.last_name} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, last_name: e.target.value }) : setNewUser({ ...newUser, last_name: e.target.value })} />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField required fullWidth margin="dense" id="email" label="Email Address" name="email" type="email" value={currentUser ? currentUser.email : newUser.email} onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })} />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    required={false}
                                    fullWidth
                                    margin="dense"
                                    id="password"
                                    label={currentUser ? 'New Password (optional)' : 'Password'}
                                    name="password"
                                    type="password"
                                    value={currentUser ? currentUser.password : newUser.password} // Use correct state
                                    onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })}
                                    helperText="Leave empty. A password setup email will be sent automatically."

                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControl fullWidth required margin="dense">
                                    <InputLabel id="role-select-label">Role</InputLabel>
                                    <Select
                                        labelId="role-select-label"
                                        id="role-select"
                                        value={currentUser ? currentUser.role : newUser.role} // Use correct state
                                        label="Role"
                                        onChange={(e) => currentUser ? setCurrentUser({ ...currentUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <MenuItem value="" disabled><em>Select Role</em></MenuItem>
                                        {/* Use the globally defined roles array */}
                                        {roles.map(role => (<MenuItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</MenuItem>))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeUserDialog} color="inherit">Cancel</Button>
                    <Button onClick={handleSaveUser} variant="contained" color="primary">{currentUser ? 'Save Changes' : 'Create User'}</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} aria-labelledby="delete-confirm-dialog-title" aria-describedby="delete-confirm-dialog-description">
                <DialogTitle id="delete-confirm-dialog-title">Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-confirm-dialog-description">
                        Are you sure you want to delete the user "{userToDelete?.name}"? This action cannot be easily undone.
                    </DialogContentText>
                    {/* Show general errors specific to the delete dialog */}
                    {error.general && isDeleteDialogOpen && <Alert severity="error" sx={{ mt: 2 }}>{error.general}</Alert>}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeDeleteDialog} color="inherit">Cancel</Button>
                    <Button onClick={confirmDeleteUser} color="error" variant="contained" autoFocus>Delete User</Button>
                </DialogActions>
            </Dialog>

            {/* Add Quote Dialog */}
            <Dialog open={isQuoteDialogOpen} onClose={() => setIsQuoteDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Quote</DialogTitle>
                <DialogContent>
                    {/* Appointment Selection Dropdown */}
                    <FormControl fullWidth margin="normal" required error={!newQuote.appointment_id && isQuoteDialogOpen}> {/* Add error state if needed */}
                        <InputLabel id="appt-select-label">Appointment</InputLabel>
                        <Select
                            labelId="appt-select-label"
                            id="appt-select"
                            value={newQuote.appointment_id}
                            onChange={(e) => setNewQuote({ ...newQuote, appointment_id: e.target.value })}
                            label="Appointment" // Ensure label is linked
                        >
                            <MenuItem value="" disabled>
                                <em>Select an Appointment</em>
                            </MenuItem>
                            {/* Map over the fetched appointments state */}
                            {loading.appointments ? (
                                <MenuItem value="" disabled><em>Loading appointments...</em></MenuItem>
                            ) : appointments.length > 0 ? (
                                // Dropdown Logic:
                                appointments.map((appt) => {
                                    // Check if a quote already exists for this appointment ID
                                    const alreadyQuoted = quotes.some(q => q.appointment_id === appt.id);
                                    return (
                                        <MenuItem key={appt.id} value={appt.id} disabled={alreadyQuoted}>
                                            {`${appt.prenom_du_prospect || ''} ${appt.nom_du_prospect || ''}`.trim()}
                                            {appt.date_du_rdv ? ` (${new Date(appt.date_du_rdv).toLocaleDateString()})` : ''}
                                            {` - ID: ${appt.id}`}
                                            {alreadyQuoted ? " (Already has quote)" : ""}
                                        </MenuItem>
                                    );
                                })
                            ) : (
                                <MenuItem value="" disabled>
                                    <em>No appointments available or failed to load.</em>
                                </MenuItem>
                            )}
                        </Select>
                        {/* Optional: Add helper text or error display here */}
                    </FormControl>

                    {/* PDF Upload Button */}
                    <Button
                        variant="outlined"
                        component="label" // Acts as a label for the hidden input
                        fullWidth
                        sx={{ mt: 2 }}
                        color={!newQuote.file && isQuoteDialogOpen ? "error" : "primary"} // Indicate if file is missing
                    >
                        {newQuote.file ? `Selected: ${newQuote.file.name}` : 'Upload Quote PDF (Required)'}
                        <input
                            type="file"
                            hidden // Hide the default browser input
                            accept="application/pdf" // Only accept PDF files
                            // Clear value on click to allow re-selecting the same file if needed
                            onClick={(e) => { e.target.value = ''; }}
                            onChange={(e) => setNewQuote({ ...newQuote, file: e.target.files?.[0] || null })} // Update state with the selected file
                        />
                    </Button>
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                        Max file size: 20MB. Only PDF format accepted.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    {/* Cancel Button */}
                    <Button onClick={() => {
                        setIsQuoteDialogOpen(false);
                        setNewQuote({ appointment_id: '', file: null }); // Reset form on cancel
                    }} color="inherit">Cancel</Button>
                    {/* Create Button - triggers handleCreateQuote */}
                    <Button onClick={handleCreateQuote} variant="contained" color="primary">
                        Create Quote
                    </Button>
                </DialogActions>
            </Dialog>

        </Box> /* End Root Flex Box */
    );
}

export default SupervisorDashboard;
