import React, { useState } from 'react';
import axios from '../axios'; // Your configured axios instance
import { useNavigate, Link as RouterLink } from 'react-router-dom';

// Material UI Components
import {
    Container, Box, TextField, Button, Typography, Alert, CircularProgress, Avatar, Paper, Link as MuiLink, Grid
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset'; // Optional Icon for forgot password

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false); // Loading state
    const navigate = useNavigate(); // If needed for navigation later

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(''); // Clear previous messages
        setError('');   // Clear previous errors
        setLoading(true); // Start loading indicator

        try {
            const response = await axios.post('/password/forgot', { email });
            // Assuming the backend sends a success message like:
            // { message: "Password reset link sent successfully." }
            setMessage(response.data.message || "Password reset link sent successfully. Please check your email.");
            // Optionally clear email field on success
            // setEmail('');
        } catch (err) {
            console.error("Forgot Password error:", err.response?.status, err.response?.data);
            let errorMsg = 'Error sending reset link.';
            if (err.response?.data?.errors?.email) {
                 // Handle specific validation errors from Laravel if email is not found/invalid
                 errorMsg = err.response.data.errors.email.join(' ');
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message; // Use backend message if available
            }
            setError(errorMsg);
        } finally {
             setLoading(false); // Stop loading indicator
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Paper elevation={3} sx={{ marginTop: 8, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <Avatar sx={{ m: 1, bgcolor: 'warning.main' }}> {/* Different color */}
                    <LockResetIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Forgot Password
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1, mb: 2 }}>
                    Enter your email address and we'll send you a link to reset your password.
                </Typography>

                 {/* Display Success or Error Message */}
                 {message && !error && (
                    <Alert severity="success" sx={{ width: '100%', mt: 1, mb: 2 }}>
                        {message}
                         {/* Add a link back to login */}
                         <MuiLink component={RouterLink} to="/login" variant="body2" sx={{ display: 'block', mt: 1 }}>
                             Return to Login
                        </MuiLink>
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" sx={{ width: '100%', mt: 1, mb: 2 }}>{error}</Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading || !!message} // Disable if loading or success message shown
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={loading || !!message} // Disable button while loading or on success
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
                    </Button>
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <MuiLink component={RouterLink} to="/login" variant="body2">
                                Back to Login
                            </MuiLink>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}

export default ForgotPassword;