import React, { useState } from 'react';
import axios from '../axios';

function ResendVerification() {


    const [email, setEmail] = useState(''); // Add state for email input

    const handleResend = async () => {
        try {
            const response = await axios.post('/email/resend', { email }); // Include email in request
            alert(response.data.message);
        } catch (error) {
            alert('Error resending verification email');
        }
    };


    



    return (
        <div>
            <h2>Resend Verification Email</h2>
            <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Enter your email" 
                required 
            />
            <button onClick={handleResend}>Resend Verification Email</button>

        </div>
    );
}

export default ResendVerification;
