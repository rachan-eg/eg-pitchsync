/**
 * Team Code Entry Page
 * Users enter their team code to link to a predefined team and usecase.
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../providers';
import { Branding } from '../../components/Branding/Branding';
import './TeamCode.css';

export const TeamCode: React.FC = () => {
    const navigate = useNavigate();
    const {
        isAuthenticated,
        user,
        logout,
        validateTeamCode,
        loginAdmin,
        teamCodeInfo
    } = useAuth();

    const [code, setCode] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Handle code input change
    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        setCode(value);
        setError(null);
    };

    // Handle admin password change
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminPassword(e.target.value);
        setError(null);
    };

    const togglePasswordVisibility = (e: React.MouseEvent) => {
        e.preventDefault();

        const input = passwordInputRef.current;
        if (!input) return;

        // Capture cursor position before toggle
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;

        setShowPassword(!showPassword);

        // Restore focus and cursor position in next frame
        requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(selectionStart, selectionEnd);
        });
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (showAdminLogin) {
            if (!adminPassword.trim()) {
                setError('PASSWORD_REQUIRED');
                return;
            }

            setIsValidating(true);
            setError(null);

            const result = await loginAdmin(adminPassword);
            if (result.success) {
                setShowSuccess(true);
                setTimeout(() => {
                    navigate('/admin', { replace: true });
                }, 1200);
            } else {
                setError(result.message || 'INVALID_PASSWORD');
                setIsValidating(false);
            }
            return;
        }

        if (!code.trim()) {
            setError('ACCESS_CODE_REQUIRED');
            return;
        }

        setIsValidating(true);
        setError(null);

        const result = await validateTeamCode(code.trim());

        if (result.isAdminTrigger) {
            setShowAdminLogin(true);
            setIsValidating(false);
            setCode('');
            return;
        }

        if (result.valid) {
            setShowSuccess(true);
            // Navigate after a brief delay to show success state
            setTimeout(() => {
                navigate('/mission', { replace: true });
            }, 1800);
        } else {
            setError(result.message || 'INVALID_CREDENTIALS');
            setIsValidating(false);
        }
    };

    // Handle logout
    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="teamcode-container">
            <div className="teamcode-background">
                <div className="aurora-blob-1"></div>
                <div className="aurora-blob-2"></div>
                <div className="aurora-blob-3"></div>
                <div className="noise-overlay"></div>
            </div>

            {/* User Info Bar */}
            {isAuthenticated && user && (
                <div className="teamcode-user-bar">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user.picture ? (
                                <img src={user.picture} alt={user.name || 'User'} className="avatar-img" />
                            ) : (
                                user.email?.charAt(0).toUpperCase() || 'U'
                            )}
                        </div>
                        <span className="user-email">{user.email}</span>
                    </div>
                    <button className="logout-button" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            )}

            <div className="teamcode-card reactive-border reactive-border--intense">
                {showSuccess ? (
                    <div className="teamcode-success">
                        <div className="success-icon animate-float">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="2" />
                                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 className="success-title">Verification Successful</h2>
                        {teamCodeInfo ? (
                            <div className="success-details">
                                <p className="team-name">{teamCodeInfo.teamName}</p>
                                <p className="team-description">{teamCodeInfo.description}</p>
                            </div>
                        ) : (
                            <div className="success-details">
                                <p className="team-name">ADMINISTRATOR</p>
                                <p className="team-description">Command Access Granted</p>
                            </div>
                        )}
                        <div className="success-loader">
                            <div className="loader-bar"></div>
                        </div>
                        <p className="success-message">Initializing Simulation Environment...</p>
                    </div>
                ) : (
                    <>
                        <div className="teamcode-header">
                            <div className="teamcode-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <h1 className="teamcode-title">
                                {showAdminLogin ? 'Admin Authorization' : 'Mission Access'}
                            </h1>
                            <p className="teamcode-subtitle">
                                {showAdminLogin
                                    ? 'Enter the administrative override password to access the command dashboard.'
                                    : 'Enter your designated squad authorization code to proceed to the briefings.'}
                            </p>
                        </div>

                        <form className="teamcode-form" onSubmit={handleSubmit}>
                            <div className="input-group reactive-border reactive-border--subtle">
                                {showAdminLogin ? (
                                    <div className="password-input-wrapper">
                                        <input
                                            ref={passwordInputRef}
                                            type={showPassword ? "text" : "password"}
                                            className={`teamcode-input ${error ? 'error' : ''}`}
                                            placeholder="••••••••"
                                            value={adminPassword}
                                            onChange={handlePasswordChange}
                                            autoFocus
                                            disabled={isValidating}
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={togglePasswordVisibility}
                                            tabIndex={-1}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        className={`teamcode-input ${error ? 'error' : ''}`}
                                        placeholder="ALPHA-SYNC"
                                        value={code}
                                        onChange={handleCodeChange}
                                        maxLength={20}
                                        autoFocus
                                        disabled={isValidating}
                                    />
                                )}
                                {error && (
                                    <p className="input-error font-mono uppercase tracking-tighter">{error}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn-primary teamcode-submit"
                                disabled={isValidating || (!showAdminLogin && !code.trim()) || (showAdminLogin && !adminPassword.trim())}
                            >
                                {isValidating ? (
                                    <>
                                        <div className="button-spinner"></div>
                                        <span>{showAdminLogin ? 'Verifying...' : 'Decrypting...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{showAdminLogin ? 'Admin Login' : 'Authorize Access'}</span>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </>
                                )}
                            </button>

                            {showAdminLogin && (
                                <button
                                    type="button"
                                    className="btn-link"
                                    style={{ marginTop: '1rem', width: '100%', opacity: 0.7 }}
                                    onClick={() => {
                                        setShowAdminLogin(false);
                                        setError(null);
                                    }}
                                >
                                    Back to Team Code
                                </button>
                            )}
                        </form>

                        <div className="teamcode-help">
                            <p>Don't have a code? Ask your team lead or event organizer.</p>
                        </div>
                    </>
                )}
            </div>

            <Branding className="branding-bottom-left" />
            <Branding useBackLogo={true} />
        </div>
    );
};
