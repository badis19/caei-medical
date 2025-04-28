import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios'; // Your configured axios instance
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../AuthContext.jsx';

// Material UI Components
import {
    AppBar, Toolbar, Typography, Card, CardHeader, CardContent, Button, TextField,
    Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CircularProgress,
    Alert, Skeleton, Paper, Chip, Divider, List, ListItem, ListItemText, IconButton, Input,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Drawer, ListItemIcon
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LogoutIcon from '@mui/icons-material/Logout';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EventIcon from '@mui/icons-material/Event';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuIcon from '@mui/icons-material/Menu';

// Toast Notifications
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// API Client Configuration
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
});
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
}, error => Promise.reject(error));

function PatientDashboard() {
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('profile');

    // Data States
    const [profileData, setProfileData] = useState(null);
    const [quoteData, setQuoteData] = useState(null);
    const [quoteContext, setQuoteContext] = useState(null);
    const [appointments, setAppointments] = useState([]);

    // UI / Form States
    const [loading, setLoading] = useState({ profile: false, quote: false, appointments: false, auth: true, action: false, fileUpload: false });
    const [error, setError] = useState({ profile: null, quote: null, appointments: null, general: null, fileUpload: null });
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editableProfileData, setEditableProfileData] = useState({});
    const [isQuoteActionDialogOpen, setIsQuoteActionDialogOpen] = useState(false);
    const [quoteAction, setQuoteAction] = useState({ quoteId: null, targetStatus: '' });
    const [refusalComment, setRefusalComment] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);


    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            setError(prev => ({ ...prev, fileUpload: null }));
        } else {
            setSelectedFile(null);
            setError(prev => ({ ...prev, fileUpload: 'Please select a valid PDF file.' }));
            toast.error('Please select a valid PDF file.');
        }
    };
    // Authorization and Initial Data Fetch
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            setLoading(prev => ({ ...prev, auth: true }));
            setError(prev => ({ ...prev, general: null }));
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const response = await apiClient.get('/user');
                const isPatient = response.data?.roles?.some(role => role.name === 'patient') || response.data?.role === 'patient';
                if (isPatient) {
                    setUserRole('patient');
                    setUserName(response.data?.name || 'Patient');
                    fetchProfile();
                    fetchQuote();
                    fetchAppointments();
                } else {
                    setError(prev => ({ ...prev, general: 'Access Denied: Patient role required.' }));
                    navigate('/login');
                }
            } catch (err) {
                setError(prev => ({ ...prev, general: 'Authentication failed. Please login again.' }));
                handleLogout();
            } finally { setLoading(prev => ({ ...prev, auth: false })); }
        };
        checkAuthAndFetch();
    }, [navigate]);

    // Data Fetching Functions
    const fetchProfile = useCallback(async () => {
        setLoading(prev => ({ ...prev, profile: true }));
        setError(prev => ({ ...prev, profile: null }));
        try {
            const response = await apiClient.get('/patient/profile');
            setProfileData(response.data);
            setEditableProfileData({
                telephone: response.data.telephone || '',
                date_de_naissance: response.data.date_de_naissance || '',
                adresse: response.data.adresse || '',
                allergies: response.data.allergies || '',
                medical_history: response.data.medical_history || ''
            });
        } catch (err) {
            setError(prev => ({ ...prev, profile: 'Failed to load profile information.' }));
            toast.error("Could not load profile.");
        } finally { setLoading(prev => ({ ...prev, profile: false })); }
    }, []);

    const fetchQuote = useCallback(async () => {
        setLoading(prev => ({ ...prev, quote: true }));
        setError(prev => ({ ...prev, quote: null }));
        try {
            const response = await apiClient.get('/patient/quote');
            setQuoteData(response.data.quote);
            setQuoteContext(response.data.appointment);
        } catch (err) {
            if (err.response?.status !== 404) {
                setError(prev => ({ ...prev, quote: 'Failed to load quote information.' }));
                toast.error("Could not load quote details.");
            }
        } finally { setLoading(prev => ({ ...prev, quote: false })); }
    }, []);

    const fetchAppointments = useCallback(async () => {
        setLoading(prev => ({ ...prev, appointments: true }));
        setError(prev => ({ ...prev, appointments: null }));
        try {
            const response = await apiClient.get('/patient/appointments');
            setAppointments(response.data.sort((a, b) => new Date(b.date_du_rdv) - new Date(a.date_du_rdv)));
        } catch (err) {
            setError(prev => ({ ...prev, appointments: 'Failed to load appointment information.' }));
            toast.error("Could not load appointments.");
        } finally { setLoading(prev => ({ ...prev, appointments: false })); }
    }, []);

    // Action Handlers
    const handleProfileUpdate = async () => {
        setLoading(prev => ({ ...prev, action: true }));
        const payload = {
            telephone: editableProfileData.telephone,
            date_de_naissance: editableProfileData.date_de_naissance || null,
            adresse: editableProfileData.adresse || null,
            allergies: editableProfileData.allergies || null,
            medical_history: editableProfileData.medical_history || null,
        };
        try {
            const response = await apiClient.put('/patient/profile', payload);
            setProfileData(response.data);
            setIsEditingProfile(false);
            toast.success("Profile updated successfully!");
        } catch (err) {
            const errorMsg = `Failed to update profile. ${err.response?.data?.message || 'Check details.'}`;
            setError(prev => ({ ...prev, general: errorMsg }));
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, action: false })); }
    };

    const handleQuoteStatusUpdate = async () => {
        if (quoteAction.targetStatus === 'refused' && !refusalComment.trim()) {
            toast.error('Refusal comment is required.');
            return;
        }
        setLoading(prev => ({ ...prev, action: true }));
        const payload = {
            status: quoteAction.targetStatus,
            ...(quoteAction.targetStatus === 'refused' && { comment: refusalComment.trim() })
        };
        try {
            const response = await apiClient.patch(`/patient/quotes/${quoteAction.quoteId}/status`, payload);
            setQuoteData(response.data);
            closeQuoteActionDialog();
            toast.success(`Quote status updated to ${quoteAction.targetStatus}.`);
        } catch (err) {
            const errorMsg = `Failed to update quote status: ${err.response?.data?.message || 'Error occurred'}`;
            setError(prev => ({ ...prev, general: errorMsg }));
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, action: false })); }
    };

    const { logout } = useContext(AuthContext); // 👈 from AuthContext

const handleLogout = () => {
  logout(); // this handles everything (removing token, context, redirect, etc.)
};


    const handleFileUpload = async () => {
        if (!selectedFile) return;
        setLoading(prev => ({ ...prev, fileUpload: true }));
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
            await apiClient.post('/patient/medical-files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(`File "${selectedFile.name}" uploaded successfully!`);
            setSelectedFile(null);
            document.getElementById('medical-file-input').value = null;
        } catch (err) {
            const errorMsg = `Failed to upload file: ${err.response?.data?.message || 'Server error'}`;
            setError(prev => ({ ...prev, fileUpload: errorMsg }));
            toast.error(errorMsg);
        } finally { setLoading(prev => ({ ...prev, fileUpload: false })); }
    };

    const handleEditProfileToggle = () => {
        if (!isEditingProfile && profileData) {
            setEditableProfileData({
                telephone: profileData.telephone || '',
                date_de_naissance: profileData.date_de_naissance || '',
                adresse: profileData.adresse || '',
                allergies: profileData.allergies || '',
                medical_history: profileData.medical_history || ''
            });
        }
        setIsEditingProfile(!isEditingProfile);
    };

    const handleEditableProfileChange = (event) => {
        setEditableProfileData(prev => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const openQuoteActionDialog = (status) => {
        if (quoteData) {
            setQuoteAction({ quoteId: quoteData.id, targetStatus: status });
            setRefusalComment('');
            setIsQuoteActionDialogOpen(true);
        }
    };

    const closeQuoteActionDialog = () => {
        setIsQuoteActionDialogOpen(false);
        setRefusalComment('');
        setQuoteAction({ quoteId: null, targetStatus: '' });
    };

    const formatDate = (dateString) => {
        return dateString ? new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
    };

    const getStatusChipColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'warning';
            case 'confirmed':
            case 'completed': return 'success';
            case 'cancelled':
            case 'refused': return 'error';
            default: return 'default';
        }
    };

    if (loading.auth) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress /><Typography sx={{ ml: 2 }}>Loading Your Dashboard...</Typography>
            </Box>
        );
    }

    if (!userRole && !loading.auth) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error">{error.general || 'Access Denied.'}</Alert>
                <Button component={RouterLink} to="/login" sx={{ mt: 2 }}>Go to Login</Button>
            </Container>
        );
    }

    const now = new Date();
    const upcomingAppointments = appointments.filter(app => new Date(app.date_du_rdv) >= now);
    const pastAppointments = appointments.filter(app => new Date(app.date_du_rdv) < now);

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            {/* App Bar */}
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
                        Patient Dashboard ({userName})
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
                        <ListItem button selected={activeSection === 'profile'} onClick={() => setActiveSection('profile')}>
                            <ListItemIcon><AssignmentIndIcon /></ListItemIcon>
                            <ListItemText primary="My Profile" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'quote'} onClick={() => setActiveSection('quote')}>
                            <ListItemIcon><ReceiptLongIcon /></ListItemIcon>
                            <ListItemText primary="My Quote" />
                        </ListItem>
                        <ListItem button selected={activeSection === 'appointments'} onClick={() => setActiveSection('appointments')}>
                            <ListItemIcon><EventIcon /></ListItemIcon>
                            <ListItemText primary="My Appointments" />
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
                {error.general && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(prev => ({ ...prev, general: null }))}>
                        {error.general}
                    </Alert>
                )}

                {/* Profile Section */}
                {activeSection === 'profile' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader
    avatar={<AssignmentIndIcon />}
    title="My Profile & Medical Info"
/>

<CardContent sx={{ flexGrow: 1 }}>
    {loading.profile ? (
        <Box>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
            <Skeleton variant="rectangular" height={80} sx={{ mt: 1 }} />
        </Box>
    ) : error.profile ? (
        <Alert severity="warning">{error.profile}</Alert>
    ) : profileData ? (
        <>
            <List dense disablePadding>
                <ListItem><ListItemText primary="Name" secondary={`${profileData.name} ${profileData.last_name}`} /></ListItem>
                <ListItem><ListItemText primary="Email" secondary={profileData.email} /></ListItem>
                <ListItem><ListItemText primary="Telephone" secondary={profileData.telephone || 'Not Provided'} /></ListItem>
                <ListItem><ListItemText primary="Date of Birth" secondary={profileData.date_de_naissance ? new Date(profileData.date_de_naissance).toLocaleDateString() : 'Not Provided'} /></ListItem>
                <ListItem><ListItemText primary="Address" secondary={profileData.adresse || 'Not Provided'} sx={{ '& .MuiListItemText-secondary': { whiteSpace: 'pre-wrap' } }} /></ListItem>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ pl: 2, pt: 1 }}>Medical Info</Typography>
                <ListItem><ListItemText primary="Allergies" secondary={profileData.allergies || 'None specified'} sx={{ '& .MuiListItemText-secondary': { whiteSpace: 'pre-wrap' } }} /></ListItem>
                <ListItem><ListItemText primary="Medical History Notes" secondary={profileData.medical_history || 'None specified'} sx={{ '& .MuiListItemText-secondary': { whiteSpace: 'pre-wrap' } }} /></ListItem>
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ pl: 2, mb: 1 }}>Upload Medical Document (PDF only)</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2 }}>
                <Button variant="outlined" component="label" startIcon={<DescriptionIcon />} size="small" disabled={loading.fileUpload}>
                    Choose PDF
                    <Input id="medical-file-input" type="file" hidden onChange={handleFileChange} accept=".pdf" />
                </Button>
                {selectedFile && (
                    <Typography variant="body2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedFile.name}
                    </Typography>
                )}
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={loading.fileUpload ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                    onClick={handleFileUpload}
                    disabled={!selectedFile || loading.fileUpload}
                    size="small"
                >
                    Upload
                </Button>
            </Box>
            {error.fileUpload && <Alert severity="error" sx={{ mt: 1, mx: 2 }}>{error.fileUpload}</Alert>}
        </>
    ) : (
        <Typography>No profile data available.</Typography>
    )}
</CardContent>

                    </Card>
                )}

                {/* Quote Section */}
                {activeSection === 'quote' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader avatar={<ReceiptLongIcon />} title="My Quote" />
                        <CardContent sx={{ flexGrow: 1 }}>
                            {loading.quote ? (
                                <Box><Skeleton variant="text" width="50%" /><Skeleton variant="text" width="70%" /><Skeleton variant="text" width="40%" /></Box>
                            ) : error.quote ? (
                                <Alert severity="warning">{error.quote}</Alert>
                            ) : quoteData ? (
                                <Box>
                                    <Typography variant="h6" gutterBottom>Amount: <em>See PDF</em></Typography>
                                    {quoteData.file_path && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                            <Typography variant="subtitle1" gutterBottom>Quote PDF:</Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<DescriptionIcon />}
                                                onClick={async () => {
                                                    try {
                                                        const token = localStorage.getItem('token');
                                                        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/patient/quotes/${quoteData.id}/download`, {
                                                            headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }
                                                        });
                                                        if (!response.ok) throw new Error(`Download failed (${response.status})`);
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = quoteData.filename || `quote_${quoteData.id}.pdf`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        window.URL.revokeObjectURL(url);
                                                    } catch (err) {
                                                        toast.error(`Could not download PDF. ${err.message}`);
                                                    }
                                                }}
                                            >
                                                {quoteData.filename || 'Download'}
                                            </Button>
                                        </Box>
                                    )}
                                    <Typography variant="body1" gutterBottom>
                                        Status: <Chip label={quoteData.status || 'N/A'} size="small" color={getStatusChipColor(quoteData.status)} variant={quoteData.status === 'pending' ? 'outlined' : 'filled'} />
                                    </Typography>
                                    {quoteData.status === 'refused' && quoteData.comment && (
                                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                            Refusal Reason: {quoteData.comment}
                                        </Typography>
                                    )}
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" gutterBottom>Related Appointment:</Typography>
                                    {quoteContext ? (
                                        <List dense disablePadding>
                                            <ListItem><ListItemText primary="Service" secondary={quoteContext.service || 'N/A'} /></ListItem>
                                            <ListItem><ListItemText primary="Date" secondary={formatDate(quoteContext.date_du_rdv)} /></ListItem>
                                            <ListItem><ListItemText primary="Agent" secondary={quoteContext.agent ? `${quoteContext.agent.name} ${quoteContext.agent.last_name}` : 'N/A'} /></ListItem>
                                            <ListItem><ListItemText primary="Clinic" secondary={quoteContext.clinique?.name || 'N/A'} /></ListItem>
                                        </List>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ pl: 2 }}>Details not available.</Typography>
                                    )}
                                    {(!quoteData.status || quoteData.status === 'pending') && (
                                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-around' }}>
                                            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => openQuoteActionDialog('accepted')} disabled={loading.action}>Accept Quote</Button>
                                            <Button variant="contained" color="error" startIcon={<CancelIcon />} onClick={() => openQuoteActionDialog('refused')} disabled={loading.action}>Refuse Quote</Button>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No quote found associated with your appointments.</Typography>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Appointments Section */}
                {activeSection === 'appointments' && (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader avatar={<EventIcon />} title="My Appointments" />
                        <CardContent sx={{ flexGrow: 1 }}>
                            {loading.appointments ? (
                                <Box>
                                    <Skeleton variant="text" width="40%" />
                                    <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
                                    <Skeleton variant="text" width="40%" sx={{ mt: 2 }} />
                                    <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
                                </Box>
                            ) : error.appointments ? (
                                <Alert severity="warning">{error.appointments}</Alert>
                            ) : appointments.length > 0 ? (
                                <Box>
                                    {upcomingAppointments.length > 0 && (
                                        <>
                                            <Typography variant="h6" gutterBottom>Upcoming</Typography>
                                            <TableContainer component={Paper} elevation={2} sx={{ mb: 3 }}>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Date & Time</TableCell>
                                                            <TableCell>Service</TableCell>
                                                            <TableCell>Clinic</TableCell>
                                                            <TableCell>Status</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {upcomingAppointments.map((app) => (
                                                            <TableRow key={app.id}>
                                                                <TableCell>{formatDate(app.date_du_rdv)}</TableCell>
                                                                <TableCell>{app.service || 'N/A'}</TableCell>
                                                                <TableCell>{app.clinique?.name || 'N/A'}</TableCell>
                                                                <TableCell><Chip label={app.status || 'N/A'} size="small" color={getStatusChipColor(app.status)} variant={app.status === 'pending' ? 'outlined' : 'filled'} /></TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </>
                                    )}
                                    {pastAppointments.length > 0 && (
                                        <>
                                            <Typography variant="h6" gutterBottom>Past</Typography>
                                            <TableContainer component={Paper} elevation={2}>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Date & Time</TableCell>
                                                            <TableCell>Service</TableCell>
                                                            <TableCell>Clinic</TableCell>
                                                            <TableCell>Status</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {pastAppointments.map((app) => (
                                                            <TableRow key={app.id}>
                                                                <TableCell>{formatDate(app.date_du_rdv)}</TableCell>
                                                                <TableCell>{app.service || 'N/A'}</TableCell>
                                                                <TableCell>{app.clinique?.name || 'N/A'}</TableCell>
                                                                <TableCell><Chip label={app.status || 'N/A'} size="small" color={getStatusChipColor(app.status)} variant={app.status === 'pending' ? 'outlined' : 'filled'} /></TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </>
                                    )}
                                    {upcomingAppointments.length === 0 && pastAppointments.length === 0 && (
                                        <Typography color="text.secondary">You have no appointments scheduled.</Typography>
                                    )}
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No appointment history found.</Typography>
                            )}
                        </CardContent>
                    </Card>
                )}
            </Box>

            {/* Quote Action Dialog */}
            <Dialog open={isQuoteActionDialogOpen} onClose={closeQuoteActionDialog}>
                <DialogTitle>Confirm Quote Decision</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to <Box component="span" sx={{ fontWeight: 'bold' }}>{quoteAction.targetStatus}</Box> this quote?
                        {quoteAction.targetStatus === 'accepted' && ' This action might be final.'}
                    </DialogContentText>
                    {quoteAction.targetStatus === 'refused' && (
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Reason for Refusal"
                            type="text"
                            fullWidth
                            multiline
                            rows={3}
                            variant="standard"
                            value={refusalComment}
                            onChange={(e) => setRefusalComment(e.target.value)}
                            sx={{ mt: 2 }}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeQuoteActionDialog} disabled={loading.action}>Cancel</Button>
                    <Button
                        onClick={handleQuoteStatusUpdate}
                        color={quoteAction.targetStatus === 'accepted' ? 'success' : 'error'}
                        variant="contained"
                        disabled={loading.action}
                    >
                        {loading.action ? <CircularProgress size={20} color="inherit" /> : `Yes, ${quoteAction.targetStatus === 'accepted' ? 'Accept' : 'Refuse'}`}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default PatientDashboard;
