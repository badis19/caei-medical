import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

// Component Imports
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // Admin
import SupervisorDashboard from './components/SupervisorDashboard';
import AgentDashboard from './components/AgentDashboard';
import ConfirmateurDashboard from './components/ConfirmateurDashboard';
import PatientDashboard from './components/PatientDashboard';
import ForgotPassword from './components/ForgotPassword';
import EmailVerification from './components/EmailVerification';
import ResetPassword from './components/ResetPassword';
import ResendVerification from './components/ResendVerification';


function App() {
    const { isAuthenticated, user } = useContext(AuthContext);

    const getDashboardPath = (role) => {
        switch (role) {
            case 'administrateur': return '/dashboard';
            case 'superviseur': return '/supervisor';
            case 'agent': return '/agent';
            case 'confirmateur': return '/confirmateur';
            case 'patient': return '/patient';
            default: return '/';
        }
    };

    const ProtectedRoute = ({ children, allowedRole }) => {
        if (!isAuthenticated) return <Navigate to="/login" replace />;
        if (!user) return null;
        if (allowedRole && user.role !== allowedRole) {
            return <Navigate to={getDashboardPath(user.role)} replace />;
        }
        return children;
    };

    const AuthRedirect = ({ children }) => {
        if (isAuthenticated && user) {
            return <Navigate to={getDashboardPath(user.role)} replace />;
        }
        return children;
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: '100vw',
            margin: 0,
            padding: 0,
            overflowX: 'hidden'
        }}>
            <Navbar />
            <main style={{
                flex: '1 0 auto',
                width: '100%',
                overflowY: 'auto',
            }}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
                    {/* Add this to handle email reset links like /reset-password?token=... */}
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/password/forgot" element={<ForgotPassword />} />
                    <Route path="/password/reset" element={<ResetPassword />} />
                    <Route path="/email/verify/:id/:hash" element={<EmailVerification />} />
                    <Route path="/email/resend" element={<ResendVerification />} />

                    {/* Protected Routes */}
                    <Route
                        path="/dashboard"
                        element={<ProtectedRoute allowedRole="administrateur"><Dashboard /></ProtectedRoute>}
                    />
                    <Route
                        path="/supervisor"
                        element={<ProtectedRoute allowedRole="superviseur"><SupervisorDashboard /></ProtectedRoute>}
                    />
                    <Route
                        path="/agent"
                        element={<ProtectedRoute allowedRole="agent"><AgentDashboard /></ProtectedRoute>}
                    />
                    <Route
                        path="/confirmateur"
                        element={<ProtectedRoute allowedRole="confirmateur"><ConfirmateurDashboard /></ProtectedRoute>}
                    />
                    <Route
                        path="/patient"
                        element={<ProtectedRoute allowedRole="patient"><PatientDashboard /></ProtectedRoute>}
                    />

                    {/* Catch-all */}
                    <Route
                        path="*"
                        element={
                            isAuthenticated && user
                                ? <Navigate to={getDashboardPath(user.role)} replace />
                                : <Navigate to="/" replace />
                        }
                    />
                </Routes>
            </main>
            <Footer />
        </div>
    );
}

export default App;
