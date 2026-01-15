import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry } from '../../types';
import './Leaderboard.css';

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    currentTeamId?: string;
}

const Icons = {
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    ),
    Trophy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H18" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    Activity: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    ),
    Zap: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    )
};

export const Leaderboard: React.FC<LeaderboardProps> = ({
    entries,
    currentTeamId
}) => {
    const navigate = useNavigate();
    const topThree = entries.slice(0, 3);
    const others = entries.slice(3);

    const getRankClass = (rank: number) => {
        if (rank === 1) return 'leaderboard__row-rank--1';
        if (rank === 2) return 'leaderboard__row-rank--2';
        if (rank === 3) return 'leaderboard__row-rank--3';
        return 'leaderboard__row-rank--default';
    };

    const handleBack = () => {
        navigate(-1); // Go back to previous page
    };

    return (
        <div className="leaderboard">

            <div className="leaderboard__container animate-fadeIn">
                {/* Header */}
                <div className="leaderboard__header">
                    <button
                        onClick={handleBack}
                        className="leaderboard__back-btn btn-secondary"
                    >
                        <Icons.ChevronLeft />
                        <span>Return to Ops</span>
                    </button>

                    <div className="leaderboard__title-section">
                        <div className="leaderboard__title-row">
                            <span className="leaderboard__title-icon"><Icons.Zap /></span>
                            <h1 className="leaderboard__title">ELITE RANKS</h1>
                            <span className="leaderboard__title-icon"><Icons.Zap /></span>
                        </div>
                        <p className="leaderboard__subtitle">
                            Global Efficiency Leaderboard • {entries.length} Active Missions
                        </p>
                    </div>

                    <div className="leaderboard__spacer" />
                </div>

                {/* Podium Section (Top 3) */}
                {topThree.length > 0 && (
                    <div className="leaderboard__podium">
                        {/* 2nd Place */}
                        {topThree[1] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--2 glass-card animate-slideUp stagger-1">
                                <div className="leaderboard__podium-icon">
                                    <Icons.Trophy />
                                </div>
                                <div className="leaderboard__podium-rank">Current 2nd</div>
                                <div className="leaderboard__podium-team">{topThree[1].team_id}</div>
                                <div className="leaderboard__podium-usecase">{topThree[1].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--2">{topThree[1].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta">{topThree[1].total_tokens} TOKENS</div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {topThree[0] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--1 glass-card animate-reveal-up">
                                <div className="leaderboard__podium-icon leaderboard__podium-icon--1">
                                    <Icons.Trophy />
                                </div>
                                <div className="leaderboard__podium-badge">
                                    <Icons.Trophy /> Current Leader
                                </div>
                                <div className="leaderboard__podium-team leaderboard__podium-team--1">{topThree[0].team_id}</div>
                                <div className="leaderboard__podium-usecase leaderboard__podium-usecase--1">{topThree[0].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--1">{topThree[0].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta leaderboard__podium-meta--1">{topThree[0].total_tokens} TOKENS</div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {topThree[2] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--3 glass-card animate-slideUp stagger-2">
                                <div className="leaderboard__podium-icon">
                                    <Icons.Trophy />
                                </div>
                                <div className="leaderboard__podium-rank">Current 3rd</div>
                                <div className="leaderboard__podium-team">{topThree[2].team_id}</div>
                                <div className="leaderboard__podium-usecase">{topThree[2].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--3">{topThree[2].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta">{topThree[2].total_tokens} TOKENS</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Remaining List */}
                <div className="leaderboard__list glass-panel animate-fadeIn stagger-3">
                    <div className="leaderboard__list-header">
                        <div className="leaderboard__list-header-pos">Pos</div>
                        <div>Operational Entity</div>
                        <div className="leaderboard__list-header-tokens">Strategic Payload</div>
                        <div className="leaderboard__list-header-score">Efficiency</div>
                        <div className="leaderboard__list-header-status">Status</div>
                    </div>

                    {entries.length === 0 ? (
                        <div className="leaderboard__empty">
                            <div className="leaderboard__empty-icon"><Icons.Trophy /></div>
                            <h3 className="leaderboard__empty-title">No Combat Data Detected</h3>
                            <p className="leaderboard__empty-text">Awaiting the first team to deploy for assessment.</p>
                        </div>
                    ) : (
                        <div className="leaderboard__list-body custom-scrollbar">
                            {others.map((entry) => {
                                const isCurrentTeam = entry.team_id === currentTeamId;
                                const isTopThree = entry.rank <= 3;

                                return (
                                    <div
                                        key={entry.team_id}
                                        className={`leaderboard__row ${isCurrentTeam ? 'leaderboard__row--current' : ''}`}
                                    >
                                        <div className={`leaderboard__row-rank ${getRankClass(entry.rank)}`}>
                                            {entry.rank.toString().padStart(2, '0')}
                                        </div>

                                        <div className="leaderboard__row-info">
                                            <div className="leaderboard__row-team-row">
                                                <span className="leaderboard__row-team">{entry.team_id}</span>
                                                {isCurrentTeam && (
                                                    <span className="leaderboard__current-badge">
                                                        <Icons.Activity /> Current Entity
                                                    </span>
                                                )}
                                            </div>
                                            <div className="leaderboard__row-usecase">
                                                {entry.usecase}
                                            </div>
                                        </div>

                                        <div className="leaderboard__row-tokens">
                                            {entry.total_tokens} <span className="leaderboard__row-tokens-unit">tk</span>
                                        </div>

                                        <div className={`leaderboard__row-score ${isTopThree ? 'leaderboard__row-score--top' : 'leaderboard__row-score--default'}`}>
                                            {entry.score.toFixed(0)}
                                        </div>

                                        <div className="leaderboard__row-status">
                                            {entry.is_complete ? (
                                                <div className="leaderboard__status-badge leaderboard__status-badge--complete">
                                                    <Icons.Check /> Finalized
                                                </div>
                                            ) : (
                                                <div className="leaderboard__status-badge leaderboard__status-badge--progress">
                                                    Phase {entry.phases_completed}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="leaderboard__footer">
                    <p className="leaderboard__footer-text">
                        Encrypted Data Link • War-Room-v2.0.0
                    </p>
                    <p className="leaderboard__footer-time">
                        System time: {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
        </div>
    );
};
