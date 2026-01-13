import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionState } from '../../types';
import './PresentationMode.css';

interface PresentationModeProps {
    session: SessionState;
    imageUrl: string;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ imageUrl }) => {
    const navigate = useNavigate();

    const handleExit = useCallback(() => {
        navigate('/reveal');
    }, [navigate]);

    // Handle ESC key to exit
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleExit();
        }
    }, [handleExit]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        // Hide scrollbar
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    return (
        <div className="presentation-mode" onClick={handleExit}>
            {/* Pure Fullscreen Image */}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt="Pitch Visualization"
                    className="presentation-mode__image animate-fadeIn"
                />
            ) : (
                <div className="presentation-mode__placeholder">
                    No image available. Press ESC to exit.
                </div>
            )}

            {/* Subtle indicator that ESC exits */}
            <div className="presentation-mode__hint">
                Press ESC to exit
            </div>
        </div>
    );
};
