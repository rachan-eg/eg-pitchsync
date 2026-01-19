/**
 * Error Display Component
 * 
 * Displays user-friendly error messages with retry capability.
 * Integrates with the resilient API error types.
 */

import React, { useState } from 'react';
import type { ApiError } from '../utils/resilientApi';

interface ErrorDisplayProps {
    error: ApiError | string | null;
    onRetry?: () => void;
    onDismiss?: () => void;
    variant?: 'inline' | 'banner' | 'toast';
    className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    onDismiss,
    variant = 'inline',
    className = '',
}) => {
    const [isRetrying, setIsRetrying] = useState(false);

    if (!error) return null;

    const errorMessage = typeof error === 'string' ? error : error.message;
    const isRetryable = typeof error === 'object' && error.retryable;
    const errorId = typeof error === 'object' ? error.errorId : undefined;

    const handleRetry = async () => {
        if (!onRetry) return;
        setIsRetrying(true);
        try {
            await onRetry();
        } finally {
            setIsRetrying(false);
        }
    };

    const baseClasses = `
        error-display
        error-display--${variant}
        ${className}
    `.trim();

    return (
        <div className={baseClasses} role="alert">
            <div className="error-display__icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6v4M10 14h.01"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            <div className="error-display__content">
                <p className="error-display__message">{errorMessage}</p>
                {errorId && (
                    <p className="error-display__id">Reference: {errorId}</p>
                )}
            </div>

            <div className="error-display__actions">
                {isRetryable && onRetry && (
                    <button
                        className="error-display__retry-btn"
                        onClick={handleRetry}
                        disabled={isRetrying}
                    >
                        {isRetrying ? (
                            <span className="error-display__spinner" />
                        ) : (
                            'Retry'
                        )}
                    </button>
                )}
                {onDismiss && (
                    <button
                        className="error-display__dismiss-btn"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

// Toast-style error notifications
interface ErrorToastProps {
    error: ApiError | string | null;
    duration?: number;
    onClose?: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
    error,
    duration = 5000,
    onClose,
}) => {
    const [visible, setVisible] = useState(true);

    React.useEffect(() => {
        if (error && duration > 0) {
            const timer = setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [error, duration, onClose]);

    if (!error || !visible) return null;

    return (
        <div className="error-toast">
            <ErrorDisplay
                error={error}
                variant="toast"
                onDismiss={() => {
                    setVisible(false);
                    onClose?.();
                }}
            />
        </div>
    );
};

export default ErrorDisplay;
