import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios';
import {
    AppBar, Toolbar, Typography, Container, Box, Card, CardHeader, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    TablePagination, Button, IconButton, CircularProgress, Alert, Dialog,
    DialogTitle, DialogContent, DialogActions, Input, Tooltip
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';


const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
});
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

function CliniqueDashboard() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [pagination, setPagination] = useState({ page: 0, rowsPerPage: 10, total: 0 });
    const [loading, setLoading] = useState({ auth: true, data: false, upload: false });
    const [error, setError] = useState(null);
    const [userName, setUserName] = useState('');

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadAppointmentId, setUploadAppointmentId] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchAppointments = useCallback(async () => {
        setLoading(prev => ({ ...prev, data: true }));
        try {
            const response = await api.get(`/clinique/appointments?page=${pagination.page + 1}`);
            setAppointments(response.data.data || []);
            setPagination(prev => ({
                ...prev,
                total: response.data.total,
                rowsPerPage: response.data.per_page
            }));
        } catch (err) {
            console.error(err);
            setError("Failed to load appointments.");
        } finally {
            setLoading(prev => ({ ...prev, data: false }));
        }
    }, [pagination.page]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await api.get('/user');
                const isClinique = response.data?.roles?.some(r => r.name === 'clinique');
                if (!isClinique) return navigate('/login');
                setUserName(response.data.name);
                fetchAppointments();
            } catch (err) {
                navigate('/login');
            } finally {
                setLoading(prev => ({ ...prev, auth: false }));
            }
        };
        checkAuth();
    }, [fetchAppointments, navigate]);

    const handleLogout = async () => {
        await api.post('/logout');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const openUploadDialog = (appointmentId) => {
        setUploadAppointmentId(appointmentId);
        setUploadDialogOpen(true);
    };

    const handleFileUpload = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        setLoading(prev => ({ ...prev, upload: true }));

        try {
            await axios.post(
                `/clinique/appointments/${uploadAppointmentId}/upload-quote`,
                formData,
                {
                    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );
            toast.success('Quote uploaded successfully!');
            fetchAppointments();
        } catch (err) {
            console.error(err.response?.data);
            toast.error('Failed to upload quote.');
        } finally {
            setLoading(prev => ({ ...prev, upload: false }));
            setUploadDialogOpen(false);
            setSelectedFile(null);
        }
    };
    const handleDeleteQuote = async (appointmentId) => {
        if (!window.confirm("Are you sure you want to delete this quote?")) return;

        try {
            await api.delete(`/clinique/appointments/${appointmentId}/delete-quote`);
            toast.success("Quote deleted successfully!");
            fetchAppointments();
        } catch (err) {
            console.error(err.response?.data);
            toast.error("Failed to delete quote.");
        }
    };


    if (loading.auth) return <CircularProgress />;

    return (
        <Box>
            <ToastContainer />
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Clinique Dashboard ({userName})
                    </Typography>
                    <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>Logout</Button>
                </Toolbar>
            </AppBar>

            <Container sx={{ mt: 4 }}>
                {error && <Alert severity="error">{error}</Alert>}
                <Card>
                    <CardHeader title="Appointments" />
                    <CardContent>
                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Patient</TableCell>
                                        <TableCell>Agent</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Service</TableCell>
                                        <TableCell>Quote</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {appointments.map(appt => (
                                        <TableRow key={appt.id}>
                                            <TableCell>{appt.patient?.name} {appt.patient?.last_name}</TableCell>
                                            <TableCell>{appt.agent?.name} {appt.agent?.last_name}</TableCell>
                                            <TableCell>{new Date(appt.date_du_rdv).toLocaleString()}</TableCell>
                                            <TableCell>{appt.service}</TableCell>
                                            <TableCell>
                                                {appt.file_url ? (
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <a href={appt.file_url} target="_blank" rel="noopener noreferrer">View</a>
                                                        <Tooltip title="Delete Quote">
                                                            <IconButton onClick={() => handleDeleteQuote(appt.id)}>
                                                                <DeleteIcon />
                                                            </IconButton>

                                                        </Tooltip>
                                                    </Box>
                                                ) : (
                                                    <Tooltip title="Upload Quote">
                                                        <IconButton onClick={() => openUploadDialog(appt.id)}>
                                                            <UploadFileIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>

                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <TablePagination
                                component="div"
                                count={pagination.total}
                                page={pagination.page}
                                onPageChange={(e, newPage) => setPagination(prev => ({ ...prev, page: newPage }))}
                                rowsPerPage={pagination.rowsPerPage}
                                onRowsPerPageChange={e => setPagination(prev => ({ ...prev, rowsPerPage: parseInt(e.target.value, 10), page: 0 }))}
                            />
                        </TableContainer>
                    </CardContent>
                </Card>
            </Container>

            <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
                <DialogTitle>Upload Quote PDF</DialogTitle>
                <DialogContent>
                    <Input type="file" fullWidth onChange={e => setSelectedFile(e.target.files[0])} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleFileUpload} disabled={loading.upload}>
                        {loading.upload ? <CircularProgress size={20} /> : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default CliniqueDashboard;
