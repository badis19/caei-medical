import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../axios'; // Your configured axios instance
import { useNavigate, Link as RouterLink } from 'react-router-dom';

// Material UI Components
import {
    AppBar, Toolbar, Typography, Container, Grid, Card, CardHeader, CardContent, Button, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper, Box,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, MenuItem, InputLabel, FormControl,
    CircularProgress, Alert, IconButton, Skeleton, Link as MuiLink, Chip, Tooltip as MuiTooltip // Renamed Tooltip to MuiTooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Confirm
import CancelIcon from '@mui/icons-material/Cancel';           // Cancel
import EmailIcon from '@mui/icons-material/Email';             // Log Email
import SmsIcon from '@mui/icons-material/Sms';                 // Log SMS
import LogoutIcon from '@mui/icons-material/Logout';
import PhoneIcon from '@mui/icons-material/Phone';             // Phone icon

// Import both ToastContainer and toast from react-toastify
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- API Client (Reused) ---
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
});
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
}, error => Promise.reject(error));
// --- End API Client ---

// --- Main Confirmateur Dashboard Component ---
function ConfirmateurDashboard() {
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');

    // --- Data States ---
    const [appointments, setAppointments] = useState([]);

    // --- Pagination States ---
    const [appointmentPage, setAppointmentPage] = useState(0);
    const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10); // Default rows per page
    const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
    const appointmentRowsPerPageOptions = useMemo(() => [10, 20, 50], []); // Options matching backend paginate(20) default helps

    // --- Filter States ---
    const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('pending'); // Default to pending

    // --- UI / Form States ---
    const [loading, setLoading] = useState({ appointments: false, auth: true, action: false }); // Add action loading state
    const [error, setError] = useState({ appointments: null, general: null });

    // Status Update Dialog
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [currentAppointmentForStatus, setCurrentAppointmentForStatus] = useState(null); // {id, name, currentStatus, targetStatus}


    // --- Authorization and Initial Data Fetch ---
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const response = await apiClient.get('/user');
                 // *** Check for 'confirmateur' role ***
                const isConfirmateur = response.data?.roles?.some(role => role.name === 'confirmateur') || response.data?.role === 'confirmateur';

                if (isConfirmateur) {
                    setUserRole('confirmateur');
                    setUserName(response.data?.name || 'Confirmateur');
                    // Fetch initial data (defaults to pending)
                    fetchAppointments(0, appointmentRowsPerPage, 'pending');
                } else {
                    const userRoleDetected = response.data?.roles?.[0]?.name || response.data?.role;
                    setError(prev => ({ ...prev, general: 'Access Denied: Confirmateur role required.' }));
                     // Redirect to appropriate dashboard or login
                     navigate(userRoleDetected === 'administrateur' ? '/dashboard' : userRoleDetected === 'superviseur' ? '/supervisor-dashboard' : userRoleDetected === 'agent' ? '/agent-dashboard' : '/login');
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                if (err.response?.status === 401) { setError(prev => ({ ...prev, general: 'Session expired. Please login again.' })); }
                else { setError(prev => ({ ...prev, general: 'Authentication failed. Please login again.' })); }
                handleLogout();
            } finally { setLoading(prev => ({ ...prev, auth: false })); }
        };
        checkAuthAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]); // Run only once

    // --- Data Fetching ---
    const fetchAppointments = useCallback(async (page = 0, limit = 10, status = '') => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const apiPage = page + 1;
             // *** Use confirmateur endpoint ***
            let url = `/confirmateur/appointments?page=${apiPage}&limit=${limit}`;
             // Append status filter - if empty string, backend defaults to 'pending' or shows all based on its logic
            if (status) {
                 url += `&status=${status}`;
            } else {
                // If you want to explicitly request 'pending' when filter is cleared, uncomment below
                // url += `&status=pending`;
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
            console.error("Failed to fetch confirmateur appointments:", err);
            setError(prev => ({ ...prev, appointments: 'Failed to fetch appointments.' }));
            setAppointments([]); setAppointmentTotalRows(0);
            toast.error("Could not load appointments.");
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, [appointmentRowsPerPageOptions]); // dependency

    // --- Effect to refetch on filter/page change ---
    useEffect(() => {
        if (userRole === 'confirmateur') {
             // Fetch using current state, reset page num if filter changes
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        }
     // Trigger fetch when filter, page, or rowsPerPage changes
    }, [appointmentStatusFilter, appointmentPage, appointmentRowsPerPage, userRole, fetchAppointments]);


    // --- Action Handlers ---

    const handleStatusUpdate = async () => {
        if (!currentAppointmentForStatus || !currentAppointmentForStatus.targetStatus) return;
        setLoading(prev => ({ ...prev, action: true })); // Start action loading

        const { id, targetStatus } = currentAppointmentForStatus;

        try {
            // *** Use confirmateur endpoint ***
            await apiClient.patch(`/confirmateur/appointments/${id}/status`, { status: targetStatus });
            closeStatusDialog();
            toast.success(`Appointment status updated to ${targetStatus}.`);
            // Refetch appointments on the current page/filter
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        } catch (err) {
             console.error("Failed to update status:", err.response?.data);
             toast.error(`Failed to update status: ${err.response?.data?.message || 'Error occurred'}`);
             // Keep dialog open on error? Optional.
             // closeStatusDialog();
        } finally {
            setLoading(prev => ({ ...prev, action: false })); // Stop action loading
        }
    };

     const handleLogCommunication = async (appointmentId, type) => {
         // Prevent spamming logs while one is in progress
        if (loading.action) return;
        setLoading(prev => ({ ...prev, action: true }));

        const endpoint = type === 'email'
            ? `/confirmateur/appointments/${appointmentId}/send-confirmation-email`
            : `/confirmateur/appointments/${appointmentId}/send-confirmation-sms`;

        const successMessage = type === 'email' ? 'Email sending logged.' : 'SMS sending logged.';
        const errorMessage = type === 'email' ? 'Failed to log email sending.' : 'Failed to log SMS sending.';

         try {
            await apiClient.post(endpoint);
            toast.info(successMessage);
            // Optionally update UI state if backend returns new info (e.g., last contacted time)
            // Maybe refetch the specific appointment if needed: fetchAppointmentDetails(appointmentId);
        } catch (err) {
             console.error(`Failed to log ${type}:`, err.response?.data);
             toast.error(`${errorMessage} ${err.response?.data?.message || ''}`);
        } finally {
             setLoading(prev => ({ ...prev, action: false }));
        }
    };

    // Handle user logout
    const handleLogout = useCallback(async () => {
        try { await apiClient.post('/logout'); }
        catch (err) { console.error('Logout API call failed (ignoring):', err); }
        finally {
            localStorage.removeItem('token');
            setUserRole(null); setUserName('');
            setAppointments([]);
            setAppointmentPage(0); setAppointmentRowsPerPage(appointmentRowsPerPageOptions[0]);
            setError({ appointments: null, general: null });
            navigate('/login');
        }
    }, [navigate, appointmentRowsPerPageOptions]);

    // --- Dialog Management ---
     const openStatusDialog = (appointment, targetStatus) => {
        setCurrentAppointmentForStatus({
            id: appointment.id,
            name: `${appointment.prenom_du_prospect} ${appointment.nom_du_prospect}`,
            currentStatus: appointment.status,
            targetStatus: targetStatus,
            date: appointment.date_du_rdv
        });
        setIsStatusDialogOpen(true);
    };
    const closeStatusDialog = () => {
        setIsStatusDialogOpen(false);
        // Delay clearing to avoid flicker if closed quickly
        setTimeout(() => setCurrentAppointmentForStatus(null), 200);
    };

    // --- MUI TablePagination Handlers ---
    const handleChangeAppointmentPage = (event, newPage) => { setAppointmentPage(newPage); }; // Let useEffect trigger fetch
    const handleChangeAppointmentRowsPerPage = (event) => {
        setAppointmentRowsPerPage(parseInt(event.target.value, 10));
        setAppointmentPage(0); // Reset to first page when changing rows per page
    };

    // --- Render Logic ---
    if (loading.auth) return ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /><Typography sx={{ml: 2}}>Verifying Access...</Typography></Box> );
    if (!userRole && !loading.auth) return ( <Container sx={{mt: 4}}><Alert severity="error">{error.general || 'Access Denied.'}</Alert><Button component={RouterLink} to="/login" sx={{mt: 2}}>Go to Login</Button></Container> );

    const appointmentStatuses = ['pending', 'confirmed', 'cancelled'];

    // --- Main Component Render ---
    return (
        <Box sx={{ flexGrow: 1 }}>
             <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Confirmateur Dashboard ({userName})
                    </Typography>
                    <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>Logout</Button>
                </Toolbar>
            </AppBar>

            {/* Main Content Area */}
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                 {error.general && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(prev => ({...prev, general: null}))}>{error.general}</Alert>}

                <Grid container spacing={3}>

                    {/* Appointment Management Section */}
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="Appointments for Confirmation" action={
                                <FormControl sx={{ minWidth: 180 }} size="small">
                                    <InputLabel id="appt-status-filter-label">Filter Status</InputLabel>
                                    <Select
                                        labelId="appt-status-filter-label"
                                        value={appointmentStatusFilter}
                                        label="Filter Status"
                                        onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                                    >
                                        {/* Option to show all if needed */}
                                        {/* <MenuItem value=""><em>All Statuses</em></MenuItem> */}
                                        {appointmentStatuses.map(status => (
                                            <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            } />
                            <CardContent>
                                {error.appointments && <Alert severity="warning" sx={{ mb: 2 }}>{error.appointments}</Alert>}
                                <TableContainer component={Paper}>
                                    <Table sx={{ minWidth: 650 }} aria-label="confirmateur appointments table" size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Patient</TableCell>
                                                <TableCell>Contact</TableCell>
                                                <TableCell>Appointment Date</TableCell>
                                                <TableCell>Service</TableCell>
                                                <TableCell>Agent</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {loading.appointments ? (
                                                Array.from(new Array(appointmentRowsPerPage)).map((_, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell colSpan={7}><Skeleton variant="text" animation="wave" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : appointments.length > 0 ? appointments.map((appt) => (
                                                <TableRow hover key={appt.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell component="th" scope="row">
                                                         {appt.patient ? `${appt.patient.name} ${appt.patient.last_name}` : `${appt.prenom_du_prospect} ${appt.nom_du_prospect}`} {/* Fallback if patient link broken */}
                                                    </TableCell>
                                                    <TableCell>
                                                        {appt.patient?.telephone && (
                                                            <MuiLink href={`tel:${appt.patient.telephone}`} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                                <PhoneIcon fontSize="inherit" sx={{ mr: 0.5 }} /> {appt.patient.telephone}
                                                            </MuiLink>
                                                        )}
                                                         {appt.patient?.email && (
                                                            <MuiLink href={`mailto:${appt.patient.email}`} sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <EmailIcon fontSize="inherit" sx={{ mr: 0.5 }}/> {appt.patient.email}
                                                            </MuiLink>
                                                        )}
                                                        {!appt.patient?.telephone && !appt.patient?.email && 'No contact'}
                                                    </TableCell>
                                                    <TableCell>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</TableCell>
                                                    <TableCell>{appt.service || 'N/A'}</TableCell>
                                                    <TableCell>{appt.agent?.name ? `${appt.agent.name} ${appt.agent.last_name}` : 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Chip label={appt.status || 'N/A'} size="small" color={appt.status === 'confirmed' ? 'success' : appt.status === 'cancelled' ? 'error' : 'default'} variant={appt.status === 'pending' ? 'outlined' : 'filled'} />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                         {/* Status Update Actions (only if pending) */}
                                                        {appt.status === 'pending' && (
                                                            <>
                                                                <MuiTooltip title="Confirm Appointment">
                                                                    <IconButton size="small" color="success" onClick={() => openStatusDialog(appt, 'confirmed')} disabled={loading.action}>
                                                                        <CheckCircleIcon fontSize="small" />
                                                                    </IconButton>
                                                                </MuiTooltip>
                                                                <MuiTooltip title="Cancel Appointment">
                                                                    <IconButton size="small" color="error" onClick={() => openStatusDialog(appt, 'cancelled')} disabled={loading.action}>
                                                                        <CancelIcon fontSize="small" />
                                                                    </IconButton>
                                                                </MuiTooltip>
                                                            </>
                                                        )}
                                                        {/* Communication Log Actions */}
                                                          <MuiTooltip title="Log Email Sent (Simulation)">
                                                            <IconButton size="small" color="primary" onClick={() => handleLogCommunication(appt.id, 'email')} disabled={loading.action || !appt.patient?.email}>
                                                                <EmailIcon fontSize="small" />
                                                            </IconButton>
                                                        </MuiTooltip>
                                                         <MuiTooltip title="Log SMS Sent (Simulation)">
                                                            <IconButton size="small" color="secondary" onClick={() => handleLogCommunication(appt.id, 'sms')} disabled={loading.action || !appt.patient?.telephone}>
                                                                <SmsIcon fontSize="small" />
                                                            </IconButton>
                                                        </MuiTooltip>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                 <TableRow><TableCell colSpan={7} align="center">No appointments found matching criteria.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    rowsPerPageOptions={appointmentRowsPerPageOptions}
                                    component="div"
                                    count={appointmentTotalRows}
                                    rowsPerPage={appointmentRowsPerPage}
                                    page={appointmentPage}
                                    onPageChange={handleChangeAppointmentPage}
                                    onRowsPerPageChange={handleChangeAppointmentRowsPerPage}
                                />
                            </CardContent>
                        </Card>
                    </Grid>

                </Grid>
            </Container>

             {/* Status Update Confirmation Dialog */}
            <Dialog open={isStatusDialogOpen} onClose={closeStatusDialog}>
                <DialogTitle>Confirm Status Change</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to mark the appointment for <Box component="span" sx={{ fontWeight: 'bold' }}>{currentAppointmentForStatus?.name}</Box> on <Box component="span" sx={{ fontWeight: 'bold' }}>{currentAppointmentForStatus?.date ? new Date(currentAppointmentForStatus.date).toLocaleDateString() : ''}</Box> as <Box component="span" sx={{ fontWeight: 'bold' }}>{currentAppointmentForStatus?.targetStatus}</Box>?
                        <br />
                        Current status: {currentAppointmentForStatus?.currentStatus}
                    </DialogContentText>
                    {/* Optional: Add a text field here for 'commentaire_confirmateur' */}
                    {/* <TextField autoFocus margin="dense" id="confirmateur_comment" label="Confirmation Comment (Optional)" type="text" fullWidth variant="standard" /> */}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeStatusDialog} disabled={loading.action}>Cancel</Button>
                    <Button
                        onClick={handleStatusUpdate}
                        color={currentAppointmentForStatus?.targetStatus === 'confirmed' ? 'success' : 'error'}
                        variant="contained"
                        disabled={loading.action}
                        autoFocus
                    >
                         {loading.action ? <CircularProgress size={20} color="inherit"/> : `Yes, ${currentAppointmentForStatus?.targetStatus === 'confirmed' ? 'Confirm' : 'Cancel'} `}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}

export default ConfirmateurDashboard;