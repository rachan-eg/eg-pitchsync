import React, { useState, useEffect } from 'react';
import type { LeaderboardEntry } from '../../types';
import './Lobby.css';

interface LobbyProps {
    onStart: (teamId: string) => void;
    loading: boolean;
    error: string | null;
}

const Icons = {
    Rocket: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" /><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" /></svg>
    ),
    Trophy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
    )
};

export const Lobby: React.FC<LobbyProps> = ({ onStart, loading, error }) => {
    const [teamId, setTeamId] = useState('');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    const getApiUrl = (path: string) => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api')) {
            return `${cleanBase}${cleanPath.substring(4)}`;
        }
        if ((cleanBase === '' || cleanBase === '/') && cleanPath.startsWith('/api')) {
            return cleanPath;
        }
        return `${cleanBase}${cleanPath}`;
    };

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch(getApiUrl('/api/leaderboard'));
                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data.entries || []);
                }
            } catch (e) {
                console.error('Failed to fetch leaderboard', e);
            }
        };
        fetchLeaderboard();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (teamId.trim()) {
            onStart(teamId.trim());
        }
    };

    return (
        <div className="lobby war-room-bg">

            <div className="lobby__content">
                <div className="lobby__grid">
                    {/* Left: Hero + Form */}
                    <div className="lobby__hero animate-slideUp">
                        <div className="lobby__logo">
                            <h1 className="lobby__title">
                                <span className="text-gradient">PITCH</span>
                                <span className="text-white">-SYNC</span>
                            </h1>
                            <p className="lobby__tagline">
                                AI-Powered Startup Pitch Simulator
                            </p>
                        </div>

                        <div className="lobby__features">
                            <div className="lobby__feature">
                                <div className="lobby__feature-dot lobby__feature-dot--primary" />
                                <span className="lobby__feature-text">Build compelling pitches with AI feedback</span>
                            </div>
                            <div className="lobby__feature">
                                <div className="lobby__feature-dot lobby__feature-dot--secondary" />
                                <span className="lobby__feature-text">Score against real startup frameworks</span>
                            </div>
                            <div className="lobby__feature">
                                <div className="lobby__feature-dot lobby__feature-dot--accent" />
                                <span className="lobby__feature-text">Generate visual pitch assets</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="lobby__form">
                            <div className="lobby__input-group">
                                <label className="lobby__label">Team Name</label>
                                <input
                                    type="text"
                                    value={teamId}
                                    onChange={(e) => setTeamId(e.target.value)}
                                    placeholder="Enter your team name..."
                                    className="lobby__input input-field"
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <div className="lobby__error">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!teamId.trim() || loading}
                                className="lobby__submit btn-primary"
                            >
                                {loading ? (
                                    <span className="lobby__submit-loading">
                                        <div className="lobby__submit-spinner loading-spinner" />
                                        Initializing...
                                    </span>
                                ) : (
                                    <>
                                        <Icons.Rocket /> Launch Mission
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="lobby__stats">
                            <div>
                                <div className="lobby__stat-value lobby__stat-value--primary">{leaderboard.length}</div>
                                <div className="lobby__stat-label">Teams Active</div>
                            </div>
                            <div>
                                <div className="lobby__stat-value">3</div>
                                <div className="lobby__stat-label">Phases</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Leaderboard Preview */}
                    <div className="lobby__leaderboard glass-card animate-fadeIn stagger-1">
                        <div className="lobby__leaderboard-header">
                            <h2 className="lobby__leaderboard-title">
                                <Icons.Trophy /> Live Rankings
                            </h2>
                            <span className="lobby__leaderboard-subtitle">Top performers</span>
                        </div>

                        {leaderboard.length === 0 ? (
                            <div className="lobby__leaderboard-empty">
                                <p className="lobby__leaderboard-empty-title">No teams yet</p>
                                <p className="lobby__leaderboard-empty-text">Be the first to compete!</p>
                            </div>
                        ) : (
                            <>
                                <div className="lobby__leaderboard-list">
                                    {leaderboard.slice(0, 5).map((entry, idx) => (
                                        <div key={entry.team_id} className="lobby__leaderboard-item">
                                            <div className={`lobby__leaderboard-rank ${idx < 3 ? 'lobby__leaderboard-rank--top' : ''}`}>
                                                {(idx + 1).toString().padStart(2, '0')}
                                            </div>
                                            <div className="lobby__leaderboard-item-info">
                                                <div className="lobby__leaderboard-item-team">{entry.team_id}</div>
                                                <div className="lobby__leaderboard-item-usecase">{entry.usecase}</div>
                                            </div>
                                            <div className="lobby__leaderboard-item-score">
                                                <div className="lobby__leaderboard-item-score-value">{entry.score.toFixed(0)}</div>
                                                <div className="lobby__leaderboard-item-score-label">pts</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {leaderboard.length > 5 && (
                                    <div className="lobby__leaderboard-more">
                                        +{leaderboard.length - 5} more teams
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <footer className="lobby__footer">
                © 2026 Pitch-Sync • Powered by AI
            </footer>
        </div>
    );
};
