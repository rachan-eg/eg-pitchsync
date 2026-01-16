import React from 'react';
import type { VoiceState } from '../../hooks/useVoiceInput';
import './animations.css';
import './StatusStrip.css';

interface StatusStripProps {
    status: VoiceState | 'processing' | 'unsupported';
    message: string | null;
}

export const StatusStrip: React.FC<StatusStripProps> = ({ status, message }) => {
    if (!message) return null;

    return (
        <div className={`stt-status stt-status--${status}`} aria-live="polite">
            {status === 'listening' && <div className="stt-status__dot" />}
            {message}
        </div>
    );
};
