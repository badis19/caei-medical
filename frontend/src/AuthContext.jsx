import React, { createContext, useState, useEffect } from 'react';
import axios from './axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) { // Only fetch if user isn’t already set
            axios.get('/user', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(response => {
                    console.log('User fetch response:', response.data);
                    setUser({ ...response.data, token }); // Include token in user object
                    setIsAuthenticated(true);
                })
                .catch(err => {
                    console.error('User fetch error:', err.response?.data);
                    localStorage.removeItem('token');
                    setIsAuthenticated(false);
                    setUser(null);
                });
        }
    }, [user]); // Depend on user to avoid re-fetching unnecessarily

    const login = async (email, password) => {
        try {
            const response = await axios.post('/login', { email, password });
            console.log('Login response:', response.data);
            const token = response.data.access_token;
            const userData = { ...response.data.user, token }; // Include token
            localStorage.setItem('token', token);
            setIsAuthenticated(true);
            setUser(userData);
            return userData;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Login failed');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};