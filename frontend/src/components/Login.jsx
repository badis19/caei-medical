import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.jsx';
import { useNavigate, Link as RouterLink } from 'react-router-dom'; // Use RouterLink for internal links

// Material UI Components
import {
    Container, Box, TextField, Button, Typography, Alert, CircularProgress, Avatar, Paper, Link as MuiLink, Grid
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'; // Optional Icon

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false); // Loading state for feedback
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors
        setLoading(true); // Start loading indicator
        try {
            const userData = await login(email, password);
            console.log('Login successful, user data:', userData);

            // Redirect based on the role received from the login function
            // Ensure your login function correctly returns/sets the user role
            if (userData.role === 'administrateur') {
                navigate('/dashboard');
            } else if (userData.role === 'superviseur') {
                // *** Make sure the supervisor route is correct ***
                navigate('/supervisor-dashboard'); // Or '/supervisor' if that's the route
            } else if (userData.role === 'agent') {
                 // *** Add Agent Redirect ***
                navigate('/agent-dashboard');    // Or '/agent' if that's the route
            }
            else {
                // Default redirect or specific routes for other roles (patient, clinic)
                console.warn("Logged in with unhandled role:", userData.role);
                navigate('/'); // Redirect to a default page or user-specific dashboard
            }

        } catch (err) {
            console.error("Login error:", err);
            const defaultError = 'Login failed. Please check your credentials.';
            let specificError = '';

            if (err.message) {
                if (err.message.toLowerCase().includes('verify your email') || err.message.toLowerCase().includes('not verified')) {
                    specificError = 'Please verify your email address.';
                } else if (err.message.toLowerCase().includes('invalid credentials')) {
                     specificError = 'Invalid email or password.';
                } else {
                    specificError = err.message; // Use error message from AuthContext if available
                }
            }

            setError(specificError || defaultError);
            // Consider not clearing fields on generic errors, only on specific ones if desired
            // setEmail('');
            // setPassword('');
        } finally {
            setLoading(false); // Stop loading indicator
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Paper elevation={3} sx={{ marginTop: 8, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Sign in
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
                    {error && (
                        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                            {error}
                            {error === 'Please verify your email address.' && (
                                <MuiLink component={RouterLink} to="/email/resend" variant="body2" sx={{ ml: 1 }}>
                                    Resend Verification?
                                </MuiLink>
                            )}
                        </Alert>
                    )}
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
                        onChange={e => setEmail(e.target.value)}
                        disabled={loading} // Disable during loading
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={loading} // Disable during loading
                    />
                    {/* Add Remember me checkbox if needed */}
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={loading} // Disable during loading
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                    </Button>
                    <Grid container>
                        <Grid item xs>
                            {/* Link to Forgot Password page */}
                            <MuiLink component={RouterLink} to="/password/forgot" variant="body2">
                                Forgot password?
                            </MuiLink>
                        </Grid>
                        <Grid item>
                             {/* Link to Register page */}
                            <MuiLink component={RouterLink} to="/register" variant="body2">
                                {"Don't have an account? Sign Up"}
                            </MuiLink>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}

export default Login;