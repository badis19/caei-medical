import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../axios'; // Your configured axios instance
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../AuthContext.jsx';

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    AppBar, Toolbar, Typography, Container, Grid, Card, CardHeader, CardContent, Button, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper, Box,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, MenuItem, InputLabel, FormControl,
    CircularProgress, Alert, IconButton, Skeleton, Link as MuiLink, Chip, Checkbox, FormControlLabel,
    Drawer, List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import BarChartIcon from '@mui/icons-material/BarChart';
import EventIcon from '@mui/icons-material/Event';
import { Tooltip } from '@mui/material';

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

function AgentDashboard() {
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [clinics, setClinics] = useState([]);
    const [appointmentPage, setAppointmentPage] = useState(0);
    const [appointmentRowsPerPage, setAppointmentRowsPerPage] = useState(10);
    const [appointmentTotalRows, setAppointmentTotalRows] = useState(0);
    const appointmentRowsPerPageOptions = useMemo(() => [5, 10, 25], []);
    const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));
    const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
    const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('');
    const [loading, setLoading] = useState({ appointments: false, stats: false, clinics: false, auth: true });
    const [error, setError] = useState({ appointments: null, stats: null, clinics: null, general: null });
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newAppointment, setNewAppointment] = useState({
        patient_id: '', service: '', date_du_rdv: '', commentaire_agent: '', qualification: '',
        commentaire_1: '', commentaire_2: '', whatsapp: false, type_de_soins: '', intervention: '',
        prise_en_charge: '', budget: '', date_intervention: '', objectif: '', clinique_id: ''
    });
    const [patients, setPatients] = useState([]);

    // **New States for Sidebar and Section Navigation**
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('statistics');

    // --- Existing Functions (Unchanged) ---
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
                    fetchAllData();
                } else {
                    const userRoleDetected = response.data?.roles?.[0]?.name || response.data?.role;
                    setError(prev => ({ ...prev, general: 'Access Denied: Agent role required.' }));
                    navigate(userRoleDetected === 'administrateur' ? '/dashboard' : userRoleDetected === 'superviseur' ? '/supervisor-dashboard' : '/login');
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                if (err.response?.status === 401) { setError(prev => ({ ...prev, general: 'Session expired. Please login again.' })); }
                else { setError(prev => ({ ...prev, general: 'Authentication failed. Please login again.' })); }
                handleLogout();
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuthAndFetch();
    }, [navigate]);

    const fetchAppointments = useCallback(async (page = 0, limit = 10, status = '') => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const apiPage = page + 1;
            let url = `/agent/appointments?page=${apiPage}&limit=${limit}`;
            if (status) url += `&status=${status}`;
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
            console.error("Failed to fetch agent appointments:", err);
            setError(prev => ({ ...prev, appointments: 'Failed to fetch appointments.' }));
            setAppointments([]); setAppointmentTotalRows(0);
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, [appointmentRowsPerPageOptions]);

    const fetchStatistics = useCallback(async (month, year) => {
        setLoading(prev => ({ ...prev, stats: true }));
        setError(prev => ({ ...prev, stats: null }));
        try {
            const response = await apiClient.get(`/agent/statistics?month=${month}&year=${year}`);
            console.log('📦 Full statistics response:', response.data);
            setStatistics(response.data || null);
        } catch (err) {
            console.error("Failed to fetch agent statistics:", err);
            setError(prev => ({ ...prev, stats: 'Failed to fetch statistics.' }));
            toast.error("Could not load statistics.");
            setStatistics(null);
        } finally {
            setLoading(prev => ({ ...prev, stats: false }));
        }
    }, []);

    const fetchPatients = useCallback(async () => {
        try {
            const response = await apiClient.get('/agent/patients');
            setPatients(response.data || []);
        } catch (err) {
            console.error("Failed to fetch patients:", err);
            toast.error("Could not load patients.");
        }
    }, []);

    const fetchClinics = useCallback(async () => {
        setLoading(prev => ({ ...prev, clinics: true }));
        setError(prev => ({ ...prev, clinics: null }));
        try {
            const response = await apiClient.get(`/agent/clinics`);
            setClinics(response.data || []);
        } catch (err) {
            console.error("Failed to fetch clinics:", err);
            setError(prev => ({ ...prev, clinics: 'Failed to fetch clinics.' }));
            toast.error("Could not load clinics list."); setClinics([]);
        } finally { setLoading(prev => ({ ...prev, clinics: false })); }
    }, []);

    useEffect(() => {
        if (userRole === 'agent') {
            fetchStatistics(statsMonth, statsYear);
        }
    }, [statsMonth, statsYear, userRole, fetchStatistics]);

    useEffect(() => {
        if (userRole === 'agent') {
            fetchAppointments(0, appointmentRowsPerPage, appointmentStatusFilter);
        }
    }, [appointmentStatusFilter, userRole, fetchAppointments, appointmentRowsPerPage]);

    const fetchAllData = useCallback(() => {
        fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        fetchStatistics(statsMonth, statsYear);
        fetchPatients();
        fetchClinics();
    }, [appointmentPage, appointmentRowsPerPage, appointmentStatusFilter, statsMonth, statsYear, fetchAppointments, fetchStatistics, fetchClinics]);

    const handleCreateAppointment = async () => {
        setError(prev => ({ ...prev, general: null }));
        if (!newAppointment.patient_id || !newAppointment.service || !newAppointment.date_du_rdv) {
            toast.warn("Please select a patient and fill in required fields: Service and Appointment Date.");
            return;
        }
        try {
            const payload = {
                ...newAppointment,
                budget: newAppointment.budget ? Number(newAppointment.budget) : null,
                clinique_id: newAppointment.clinique_id ? Number(newAppointment.clinique_id) : null,
                whatsapp: Boolean(newAppointment.whatsapp),
            };
            const response = await apiClient.post(`/agent/appointments`, payload);
            closeCreateDialog();
            toast.success(`Appointment for ${response.data.nom_du_prospect} created successfully!`);
            fetchAppointments(appointmentPage, appointmentRowsPerPage, appointmentStatusFilter);
        } catch (err) {
            console.error(`Failed to create appointment:`, err.response?.data);
            const errors = err.response?.data?.errors;
            let errorMsg = `Failed to create appointment.`;
            if (errors) { errorMsg += " " + Object.values(errors).flat().join(' '); }
            else { errorMsg += " " + (err.response?.data?.message || 'Check details or patient may already exist.'); }
            setError(prev => ({ ...prev, general: errorMsg }));
            toast.error(errorMsg);
        }
    };

   const { logout } = useContext(AuthContext); // 👈 from AuthContext

const handleLogout = () => {
  logout(); // this handles everything (removing token, context, redirect, etc.)
};


    const openCreateDialog = () => {
        setError(prev => ({ ...prev, general: null }));
        setNewAppointment({
            patient_id: '', service: '', date_du_rdv: '', commentaire_agent: '', qualification: '',
            commentaire_1: '', commentaire_2: '', whatsapp: false, type_de_soins: '', intervention: '',
            prise_en_charge: '', budget: '', date_intervention: '', objectif: '', clinique_id: ''
        });
        setIsCreateDialogOpen(true);
    };
    const closeCreateDialog = () => setIsCreateDialogOpen(false);

    const handleChangeAppointmentPage = (event, newPage) => { fetchAppointments(newPage, appointmentRowsPerPage, appointmentStatusFilter); };
    const handleChangeAppointmentRowsPerPage = (event) => { fetchAppointments(0, parseInt(event.target.value, 10), appointmentStatusFilter); };

    // **New Function for Sidebar Navigation**
    const setSection = (section) => {
        setActiveSection(section);
        setSidebarOpen(false);
    };

    // --- Render Logic ---
    if (loading.auth) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress /><Typography sx={{ ml: 2 }}>Verifying Access...</Typography>
        </Box>
    );
    if (!userRole && !loading.auth) return (
        <Container sx={{ mt: 4 }}>
            <Alert severity="error">{error.general || 'Access Denied.'}</Alert>
            <Button onClick={() => navigate('/login')} sx={{ mt: 2 }}>Go to Login</Button>
        </Container>
    );

    const appointmentStatuses = ['pending', 'confirmed', 'cancelled'];

    // --- Updated Render with New Layout ---
    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            {/* AppBar */}
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Agent Dashboard ({userName})
                    </Typography>
                    <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>Logout</Button>
                </Toolbar>
            </AppBar>

            {/* Sidebar Drawer */}
            <Drawer
                variant="persistent"
                anchor="left"
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                sx={{
                    width: 240,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {
                        width: 240,
                        boxSizing: 'border-box',
                        top: '64px',
                        height: 'calc(100% - 64px)',
                    },
                }}
            >
                <Toolbar />
                <Box sx={{ overflow: 'auto' }}>
                    <List>
                        <ListItem button selected={activeSection === 'statistics'} onClick={() => setSection('statistics')}>
                            <ListItemIcon><BarChartIcon /></ListItemIcon>
                            <ListItemText primary="Statistics" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'appointments'} onClick={() => setSection('appointments')}>
                            <ListItemIcon><EventIcon /></ListItemIcon>
                            <ListItemText primary="Appointments" />
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
                    mt: '64px',
                    height: 'calc(100vh - 64px)',
                    overflow: 'auto',
                    transition: (theme) => theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    marginLeft: sidebarOpen ? `240px` : 0,
                }}
            >
                {error.general && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(prev => ({ ...prev, general: null }))}>{error.general}</Alert>}

                {/* Statistics Section */}
                {activeSection === 'statistics' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader
                            title="Your Statistics"
                            subheader={statsMonth && statsYear ? `Overview for ${new Date(statsYear, statsMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}` : 'Select month and year'}
                        />
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                                <FormControl sx={{ minWidth: 150 }} size="small">
                                    <InputLabel id="stats-month-label">Month</InputLabel>
                                    <Select labelId="stats-month-label" value={statsMonth} label="Month" onChange={(e) => setStatsMonth(e.target.value)}>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <MenuItem key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl sx={{ minWidth: 120 }} size="small">
                                    <InputLabel id="stats-year-label">Year</InputLabel>
                                    <Select labelId="stats-year-label" value={statsYear} label="Year" onChange={(e) => setStatsYear(e.target.value)}>
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                            <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                            {loading.stats ? (
                                <Grid container spacing={2}>
                                    <Grid item xs={6} sm={3}><Skeleton variant="text" /></Grid>
                                    <Grid item xs={6} sm={3}><Skeleton variant="text" /></Grid>
                                    <Grid item xs={6} sm={3}><Skeleton variant="text" /></Grid>
                                    <Grid item xs={6} sm={3}><Skeleton variant="text" /></Grid>
                                </Grid>
                            ) : statistics ? (
                                <>
                                    {console.log('📊 Chart data:', statistics.evolution)}
                                    <ResponsiveContainer width="100%" height={350}>
                                        <LineChart data={statistics.evolution || []}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis allowDecimals={false} />
                                            <RechartsTooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke="#4caf50" strokeWidth={2} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#f44336" strokeWidth={2} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="pending" name="Pending" stroke="#ff9800" strokeWidth={2} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            ) : (
                                <Alert severity="warning">{error.stats || 'Could not load statistics.'}</Alert>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Appointments Section */}
                {activeSection === 'appointments' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader
                            title="My Appointments"
                            action={
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <FormControl sx={{ minWidth: 150, mr: 2 }} size="small">
                                        <InputLabel id="appt-status-filter-label">Filter Status</InputLabel>
                                        <Select
                                            labelId="appt-status-filter-label"
                                            value={appointmentStatusFilter}
                                            label="Filter Status"
                                            onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                                        >
                                            <MenuItem value=""><em>All Statuses</em></MenuItem>
                                            {appointmentStatuses.map(status => (
                                                <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                                        New Appointment
                                    </Button>
                                </Box>
                            }
                        />
                        <CardContent sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {error.appointments && <Alert severity="warning" sx={{ mb: 2 }}>{error.appointments}</Alert>}
                            <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
                                <Table sx={{ minWidth: 650 }} aria-label="agent appointments table" size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Prospect</TableCell>
                                            <TableCell>Contact</TableCell>
                                            <TableCell>Service</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Clinic</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
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
                                                <TableCell component="th" scope="row">{appt.prenom_du_prospect} {appt.nom_du_prospect}</TableCell>
                                                <TableCell>{appt.telephone}<br />{appt.email}</TableCell>
                                                <TableCell>{appt.service || 'N/A'}</TableCell>
                                                <TableCell>{appt.date_du_rdv ? new Date(appt.date_du_rdv).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</TableCell>
                                                <TableCell>{appt.clinique?.name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Chip label={appt.status || 'N/A'} size="small" color={appt.status === 'confirmed' ? 'success' : appt.status === 'cancelled' ? 'error' : 'default'} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Editing not allowed">
                                                        <span>
                                                            <IconButton size="small" disabled>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title="Deletion not allowed">
                                                        <span>
                                                            <IconButton size="small" color="error" disabled>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
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
                )}
            </Box>

            {/* Create Appointment Dialog (Unchanged) */}
            <Dialog open={isCreateDialogOpen} onClose={closeCreateDialog} maxWidth="md" fullWidth>
                <DialogTitle>Create New Appointment</DialogTitle>
                <DialogContent>
                    <Box component="form" noValidate autoComplete="off" sx={{ mt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField required fullWidth margin="dense" label="Service" value={newAppointment.service} onChange={(e) => setNewAppointment({ ...newAppointment, service: e.target.value })} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField required fullWidth margin="dense" label="Appointment Date" type="date" value={newAppointment.date_du_rdv} onChange={(e) => setNewAppointment({ ...newAppointment, date_du_rdv: e.target.value })} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControl fullWidth required margin="dense">
                                    <InputLabel id="patient-select-label">Select Patient</InputLabel>
                                    <Select
                                        labelId="patient-select-label"
                                        value={newAppointment.patient_id}
                                        onChange={(e) => setNewAppointment({ ...newAppointment, patient_id: e.target.value })}
                                        label="Select Patient"
                                    >
                                        {patients.map(p => (
                                            <MenuItem key={p.id} value={p.id}>
                                                {p.name} {p.last_name} ({p.email})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FormControlLabel control={<Checkbox checked={newAppointment.whatsapp} onChange={(e) => setNewAppointment({ ...newAppointment, whatsapp: e.target.checked })} />} label="WhatsApp Contact?" />
                            </Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Agent Comment" value={newAppointment.commentaire_agent} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_agent: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Comment 1" value={newAppointment.commentaire_1} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_1: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Comment 2" value={newAppointment.commentaire_2} onChange={(e) => setNewAppointment({ ...newAppointment, commentaire_2: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Qualification" value={newAppointment.qualification} onChange={(e) => setNewAppointment({ ...newAppointment, qualification: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Type of Care" value={newAppointment.type_de_soins} onChange={(e) => setNewAppointment({ ...newAppointment, type_de_soins: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Intervention" value={newAppointment.intervention} onChange={(e) => setNewAppointment({ ...newAppointment, intervention: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Coverage" value={newAppointment.prise_en_charge} onChange={(e) => setNewAppointment({ ...newAppointment, prise_en_charge: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Budget" type="number" value={newAppointment.budget} onChange={(e) => setNewAppointment({ ...newAppointment, budget: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth margin="dense" label="Intervention Date" type="date" value={newAppointment.date_intervention} onChange={(e) => setNewAppointment({ ...newAppointment, date_intervention: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
                            <Grid item xs={12}><TextField fullWidth margin="dense" label="Objective" multiline rows={2} value={newAppointment.objectif} onChange={(e) => setNewAppointment({ ...newAppointment, objectif: e.target.value })} /></Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeCreateDialog}>Cancel</Button>
                    <Button onClick={handleCreateAppointment} variant="contained">Create Appointment</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default AgentDashboard;