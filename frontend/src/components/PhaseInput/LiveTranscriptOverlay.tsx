import React from 'react';
import './LiveTranscriptOverlay.css';

interface LiveTranscriptOverlayProps {
    transcript: string;
    existingText: string;
    visible: boolean;
}

export const LiveTranscriptOverlay: React.FC<LiveTranscriptOverlayProps> = ({ transcript, existingText, visible }) => {
    if (!visible || !transcript) return null;

    return (
        <div className="stt-overlay-mirror" aria-hidden="true">
            <span className="stt-mirror-text">{existingText}</span>
            <span className="stt-ghost-text"> {transcript}</span>
        </div>
    );
};
