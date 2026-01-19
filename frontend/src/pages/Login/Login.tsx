/**
 * Login Page
 * SSO login entry point using Keycloak authentication.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers';
import { keycloakManager } from '../../utils/keycloakManager';
import { Branding } from '../../components/Branding/Branding';
import { AuthLoading } from '../../components/AuthLoading/AuthLoading';
import './Login.css';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, login } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isInitiating, setIsInitiating] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            navigate('/team-code', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    const handleLogin = async () => {
        setError(null);
        setIsInitiating(true);
        try {
            await login('/team-code');
        } catch (err) {
            setError('Failed to initiate login. Please try again.');
            setIsInitiating(false);
        }
    };

    if (isLoading) {
        return <AuthLoading message="Synchronizing Auth State" />;
    }

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="aurora-blob-1"></div>
                <div className="aurora-blob-2"></div>
                <div className="aurora-blob-3"></div>
                <div className="aurora-blob-4"></div>
                <div className="noise-overlay"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M24 4L4 14V34L24 44L44 34V14L24 4Z" stroke="url(#logo-gradient)" strokeWidth="2.5" fill="none" />
                            <circle cx="24" cy="24" r="8" stroke="url(#logo-gradient)" strokeWidth="2" />
                            <path d="M24 16V32M16 24H32" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" />
                            <defs>
                                <linearGradient id="logo-gradient" x1="4" y1="4" x2="44" y2="44">
                                    <stop stopColor="var(--primary)" />
                                    <stop offset="1" stopColor="var(--accent)" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="login-title">PITCH-SYNC</h1>
                    <p className="login-subtitle">AI Strategic Catalyst</p>
                </div>

                <div className="login-content">
                    <div className="login-welcome-section">
                        <h2 className="login-welcome">Authentication Required</h2>
                        <p className="login-description">
                            Access the mission-critical suite. Sign in with your organization's secure gateway.
                        </p>
                    </div>

                    {error && (
                        <div className="login-error animate-slideUp">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        className="btn-primary login-button"
                        onClick={handleLogin}
                        disabled={isInitiating}
                    >
                        {isInitiating ? (
                            <>
                                <div className="button-spinner"></div>
                                <span>Establishing Link...</span>
                            </>
                        ) : (
                            <>
                                <svg className="sso-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor" />
                                </svg>
                                <span>Sign In via SSO</span>
                            </>
                        )}
                    </button>

                    <div className="login-footer">
                        {import.meta.env.VITE_ALLOW_BYPASS === 'true' && (
                            <button
                                className="btn-secondary dev-bypass-button"
                                style={{ marginTop: '1rem', width: '100%', opacity: 0.7 }}
                                onClick={() => {
                                    keycloakManager.setMockSession();
                                    window.location.reload();
                                }}
                            >
                                🧪 Bypass SSO (Dev Mode)
                            </button>
                        )}
                        <p className="login-help">
                            Network issues? Contact systems administration.
                        </p>
                    </div>
                </div>
            </div>

            <div className="login-features">
                <div className="feature-item stagger-1">
                    <span className="feature-icon">⚡</span>
                    <span>Real-time Synthesis</span>
                </div>
                <div className="feature-item stagger-2">
                    <span className="feature-icon">🛡️</span>
                    <span>Secure Protocols</span>
                </div>
                <div className="feature-item stagger-3">
                    <span className="feature-icon">🧠</span>
                    <span>AI-Core Analysis</span>
                </div>
            </div>

            <Branding />
        </div >
    );
};
