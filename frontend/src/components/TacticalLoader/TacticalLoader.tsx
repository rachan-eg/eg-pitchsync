import React, { useState, useEffect, useRef } from 'react';
import './TacticalLoader.css';

interface TacticalLoaderProps {
    message?: string;
    subMessage?: string;
    /** Maximum time in ms before showing timeout UI (default: 45000 = 45s) */
    timeoutMs?: number;
    /** Callback when user requests a retry */
    onRetry?: () => void;
    /** Callback when user wants to dismiss/cancel */
    onCancel?: () => void;
    /** Show as full-screen overlay (default: true) */
    fullScreen?: boolean;
}

const TACTICAL_MESSAGES = [
    'Establishing secure uplink...',
    'Decrypting strategic assets...',
    'Analyzing tactical data...',
    'Processing neural pathways...',
    'Synchronizing intel streams...',
    'Calibrating response matrix...',
    'Engaging cognitive protocols...',
];

export const TacticalLoader: React.FC<TacticalLoaderProps> = ({
    message = 'Processing Intel',
    subMessage,
    timeoutMs = 45000,
    onRetry,
    onCancel,
    fullScreen = true
}) => {
    const [elapsed, setElapsed] = useState(0);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [currentMessage, setCurrentMessage] = useState(TACTICAL_MESSAGES[0]);
    const startTimeRef = useRef(Date.now());

    // Cycle through tactical messages
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessage(prev => {
                const idx = TACTICAL_MESSAGES.indexOf(prev);
                return TACTICAL_MESSAGES[(idx + 1) % TACTICAL_MESSAGES.length];
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Track elapsed time and timeout
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const elapsedMs = now - startTimeRef.current;
            setElapsed(Math.floor(elapsedMs / 1000));

            if (elapsedMs >= timeoutMs && !isTimedOut) {
                setIsTimedOut(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [timeoutMs, isTimedOut]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    };

    const containerClass = fullScreen
        ? 'tactical-loader tactical-loader--fullscreen'
        : 'tactical-loader tactical-loader--inline';

    return (
        <div className={containerClass}>
            <div className="tactical-loader__backdrop" />

            <div className="tactical-loader__content">
                {/* Animated Orbital Ring */}
                <div className="tactical-loader__orb">
                    <div className="tactical-loader__ring tactical-loader__ring--outer" />
                    <div className="tactical-loader__ring tactical-loader__ring--middle" />
                    <div className="tactical-loader__ring tactical-loader__ring--inner" />
                    <div className="tactical-loader__core">
                        {isTimedOut ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                                <rect x="9" y="9" width="6" height="6" />
                                <line x1="9" y1="1" x2="9" y2="4" />
                                <line x1="15" y1="1" x2="15" y2="4" />
                                <line x1="9" y1="20" x2="9" y2="23" />
                                <line x1="15" y1="20" x2="15" y2="23" />
                                <line x1="20" y1="9" x2="23" y2="9" />
                                <line x1="20" y1="15" x2="23" y2="15" />
                                <line x1="1" y1="9" x2="4" y2="9" />
                                <line x1="1" y1="15" x2="4" y2="15" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Title & Status */}
                <h2 className={`tactical-loader__title ${isTimedOut ? 'tactical-loader__title--warning' : ''}`}>
                    {isTimedOut ? 'Connection Delayed' : message}
                </h2>

                {/* Progress Bar */}
                <div className="tactical-loader__progress">
                    <div className={`tactical-loader__progress-bar ${isTimedOut ? 'tactical-loader__progress-bar--warning' : ''}`} />
                </div>

                {/* Subtitle / Dynamic Message */}
                <p className="tactical-loader__sub">
                    {isTimedOut
                        ? 'The operation is taking longer than expected. This may be due to high server load.'
                        : (subMessage || currentMessage)
                    }
                </p>

                {/* Elapsed Timer */}
                <div className="tactical-loader__timer">
                    <span className="tactical-loader__timer-label">ELAPSED</span>
                    <span className={`tactical-loader__timer-value ${isTimedOut ? 'tactical-loader__timer-value--warning' : ''}`}>
                        {formatTime(elapsed)}
                    </span>
                </div>

                {/* Timeout Actions */}
                {isTimedOut && (onRetry || onCancel) && (
                    <div className="tactical-loader__actions">
                        {onRetry && (
                            <button className="tactical-loader__btn tactical-loader__btn--primary" onClick={onRetry}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                                Retry Operation
                            </button>
                        )}
                        {onCancel && (
                            <button className="tactical-loader__btn tactical-loader__btn--secondary" onClick={onCancel}>
                                Cancel
                            </button>
                        )}
                    </div>
                )}

                {/* Particles */}
                <div className="tactical-loader__particles">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="tactical-loader__particle" style={{ animationDelay: `${i * 0.5}s` }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TacticalLoader;
