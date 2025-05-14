import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

// Delay Echo setup until token is reliably available
let echoInstance = null;

export function initializeEcho(token) {
    echoInstance = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
        forceTLS: false, // ✅ force non-secure
        enabledTransports: ['ws'], // ✅ disable wss
        authEndpoint: `${import.meta.env.VITE_APP_URL}/api/broadcasting/auth`,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });

    window.Echo = echoInstance;
    return echoInstance;
}

