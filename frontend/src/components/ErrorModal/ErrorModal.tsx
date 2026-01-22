import React from 'react';
import './ErrorModal.css';

interface ErrorModalProps {
    message: string;
    onCallback: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ message, onCallback }) => {
    return (
        <div className="error-modal animate-fadeIn">
            <div className="error-modal__content glass-panel reactive-border reactive-border--danger">
                <h2 className="error-modal__header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    System Error
                </h2>
                <p className="error-modal__message">
                    {message}
                </p>
                <div className="error-modal__actions">
                    <button
                        onClick={onCallback}
                        className="error-modal__dismiss-btn btn-secondary"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};
