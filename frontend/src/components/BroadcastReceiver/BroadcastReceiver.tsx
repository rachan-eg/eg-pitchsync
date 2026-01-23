import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiUrl } from '../../utils';

interface BroadcastMessage {
    message: string;
    active: boolean;
    timestamp: number;
    id: number;
}

export const BroadcastReceiver: React.FC = () => {
    const { pathname } = useLocation();
    const [msg, setMsg] = useState<BroadcastMessage | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [lastSeenId, setLastSeenId] = useState(() => {
        return parseInt(localStorage.getItem('pitch_sync_last_broadcast_id') || '0', 10);
    });

    useEffect(() => {
        // Skip polling on admin dashboard
        if (pathname.startsWith('/admin')) return;

        const checkBroadcast = async () => {
            if (document.hidden) return;
            try {
                const res = await fetch(getApiUrl('/api/broadcast'));
                if (res.ok) {
                    const data: BroadcastMessage = await res.json();
                    if (data.active && data.message && data.id > lastSeenId) {
                        // Check if message is expired (older than 2 minutes)
                        const now = Math.floor(Date.now() / 1000);
                        if (now - data.timestamp > 120) {
                            // Just update ID to ignore it, don't show
                            setLastSeenId(data.id);
                            localStorage.setItem('pitch_sync_last_broadcast_id', data.id.toString());
                            return;
                        }

                        setMsg(data);
                        setLastSeenId(data.id);
                        localStorage.setItem('pitch_sync_last_broadcast_id', data.id.toString());
                        setIsVisible(true);

                        // Dynamic duration: 100ms per character, min 5s, max 15s
                        const duration = Math.min(15000, Math.max(5000, data.message.length * 100));
                        setTimeout(() => setIsVisible(false), duration);
                    }
                }
            } catch (err) {
                // Silent fail
            }
        };

        const interval = setInterval(checkBroadcast, 30000); // Check every 30s
        checkBroadcast(); // Initial check

        return () => clearInterval(interval);
    }, [lastSeenId, pathname]);

    // Don't show broadcasts on Admin Dashboard
    if (pathname.startsWith('/admin')) return null;

    if (!isVisible || !msg) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '2rem',
            left: '50%',
            transform: 'translate(-50%, 0)',
            zIndex: 99999,
            background: 'rgba(124, 58, 237, 0.95)',
            border: '1px solid #fff',
            borderRadius: '99px',
            padding: '0.75rem 2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            color: '#fff',
            fontWeight: 800,
            animation: 'slideDown 0.5s ease-out'
        }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12" />
                <circle cx="17" cy="7" r="5" />
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}>{msg.message}</span>
            <button
                onClick={() => setIsVisible(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '1rem', fontSize: '1.2rem' }}
            >
                ×
            </button>
            <style>{`
                @keyframes slideDown {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
