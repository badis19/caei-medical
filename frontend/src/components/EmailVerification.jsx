import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import axios from '../axios'; // Your configured axios instance

// Material UI Components
import { Container, Box, Typography, Alert, CircularProgress, Button, Paper } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

function EmailVerification() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const id = searchParams.get('id');
    const hash = searchParams.get('hash');

    // State for verification status
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
    const [message, setMessage] = useState('Please wait while we verify your email...');

    useEffect(() => {
        // Ensure ID and Hash are present
        if (!id || !hash) {
            setStatus('error');
            setMessage('Invalid verification link. Missing required parameters.');
            return;
        }

        const verifyEmail = async () => {
            setStatus('verifying'); // Explicitly set verifying status
            try {
                // Use the correct verify endpoint from your api.php
                // It might be /email/verify/{id}/{hash}?expires=...&signature=...
                // Axios should handle the query parameters automatically if they are part of the URL string
                // For clarity, let's reconstruct the expected path structure
                const expires = searchParams.get('expires');
                const signature = searchParams.get('signature');
                const verificationUrl = `/email/verify/${id}/${hash}?expires=${expires}&signature=${signature}`;

                // Or if your backend doesn't need expires/signature in GET:
                // const verificationUrl = `/email/verify/${id}/${hash}`;

                const response = await axios.get(verificationUrl);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');

                // Optional: Redirect to login after a delay
                setTimeout(() => {
                    navigate('/login');
                }, 3000); // Redirect after 3 seconds

            } catch (error) {
                console.error("Email verification error:", error.response?.status, error.response?.data);
                setStatus('error');
                setMessage(error.response?.data?.message || 'Error verifying email. The link may be invalid or expired.');
            }
        };

        verifyEmail();
     // Add searchParams to dependency array as it contains id/hash/expires/signature
    }, [id, hash, navigate, searchParams]);

    return (
        <Container component="main" maxWidth="sm">
            <Paper elevation={3} sx={{ marginTop: 8, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
                    Email Verification
                </Typography>

                {status === 'verifying' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <CircularProgress />
                        <Typography>{message}</Typography>
                    </Box>
                )}

                {status === 'success' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                         <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60 }} />
                        <Alert severity="success" sx={{ width: '100%' }}>{message}</Alert>
                        <Typography variant="body2" sx={{ mt: 1 }}>Redirecting to login...</Typography>
                        <Button component={RouterLink} to="/login" variant="contained" sx={{ mt: 2 }}>
                             Login Now
                        </Button>
                    </Box>
                )}

                {status === 'error' && (
                     <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                         <ErrorOutlineIcon color="error" sx={{ fontSize: 60 }}/>
                        <Alert severity="error" sx={{ width: '100%' }}>{message}</Alert>
                         <Button component={RouterLink} to="/email/resend" variant="outlined" sx={{ mt: 2 }}>
                             Resend Verification Email?
                        </Button>
                          <Button component={RouterLink} to="/login" variant="contained" color="secondary" sx={{ mt: 1 }}>
                             Go to Login
                        </Button>
                    </Box>
                )}
            </Paper>
        </Container>
    );
}

export default EmailVerification;