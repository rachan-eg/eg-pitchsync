import React from 'react';
import './AuthLoading.css';

interface AuthLoadingProps {
    message?: string;
}

export const AuthLoading: React.FC<AuthLoadingProps> = ({
    message = "Synchronizing Authentication State"
}) => {
    return (
        <div className="auth-loading-container">
            <div className="auth-loading-background">
                <div className="auth-loading-grid"></div>
                <div className="auth-loading-orb"></div>
            </div>

            <div className="auth-loading-content">
                <div className="auth-loading-hex">
                    <div className="hex-inner">
                        <div className="hex-core"></div>
                        <div className="hex-orbit"></div>
                    </div>
                </div>

                <div className="auth-loading-text">
                    <h2 className="loading-status">{message}</h2>
                    <div className="loading-progress-container">
                        <div className="loading-progress-bar"></div>
                    </div>
                    <div className="loading-meta">
                        <span className="meta-item">ENCRYPTED_LINK: ACTIVE</span>
                        <span className="meta-item">PROTOCOL: SECURE_SSO</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
