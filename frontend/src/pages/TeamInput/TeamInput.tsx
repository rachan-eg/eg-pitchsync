import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import { Branding } from '../../components/Branding/Branding';
import './TeamInput.css';

interface TeamInputProps {
    usecaseTitle: string;
    loading: boolean;
    error: string | null;
}

const Icons = {
    Users: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    ),
    Lightbulb: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></svg>
    ),
    Play: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
    )
};

export const TeamInput: React.FC<TeamInputProps> = ({ usecaseTitle, loading, error }) => {
    const navigate = useNavigate();
    const { initSession } = useApp();
    const [teamId, setTeamId] = React.useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (teamId.trim()) {
            const result = await initSession(teamId.trim());
            if (result.success) {
                if (result.isResumed || result.isComplete) {
                    navigate('/war-room');
                } else {
                    navigate('/mission');
                }
            }
        }
    };

    return (
        <div className="team-input war-room-bg">

            <div className="team-input__container animate-slideUp">
                {/* Back indicator */}
                <div className="team-input__header">
                    <span className="team-input__mission-label">ACTIVE MISSION PATH</span>
                    <h2 className="team-input__mission-title">{usecaseTitle}</h2>
                </div>

                {/* Team Input Card */}
                <div className="team-input__card glass-panel">
                    <div className="team-input__card-glow" />

                    <div className="team-input__card-content">
                        <div className="team-input__icon">
                            <Icons.Users />
                        </div>
                        <h1 className="team-input__title">Team Credentials</h1>
                        <p className="team-input__subtitle">
                            Identity verification required to commence
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="team-input__form">
                        <div className="team-input__field-group">
                            <label className="team-input__label">
                                Team Name
                            </label>
                            <input
                                type="text"
                                value={teamId}
                                onChange={(e) => setTeamId(e.target.value)}
                                placeholder="E.G., ALPHA-9, NEURAL-LINK..."
                                className="team-input__input"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="team-input__error">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!teamId.trim() || loading}
                            className="team-input__submit btn-primary"
                        >
                            {loading ? (
                                <span className="team-input__submit-loading">
                                    <div className="team-input__submit-spinner loading-spinner" />
                                    SYNCING...
                                </span>
                            ) : (
                                <>
                                    Engage Mission
                                    <Icons.Play />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Tips */}
                <div className="team-input__tips">
                    <Icons.Lightbulb />
                    <p>Team identity will be logged on global ranks</p>
                </div>
            </div>
            <Branding />
        </div>
    );
};
