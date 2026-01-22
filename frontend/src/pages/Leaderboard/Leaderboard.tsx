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

type LeaderboardTrack = 'ELITE' | 'LEGENDS' | 'MINIMALIST' | 'BLITZ' | 'PHASES';

export const Leaderboard: React.FC<LeaderboardProps> = ({
    entries,
    currentTeamId
}) => {
    const navigate = useNavigate();
    const [track, setTrack] = React.useState<LeaderboardTrack>('ELITE');

    // Filter and Sort based on track
    const processedEntries = React.useMemo(() => {
        let result = [...entries];

        // Basic filter: Hide zero-score empty sessions to reduce noise
        result = result.filter(e => e.score > 0);

        if (track === 'LEGENDS') {
            // Show active runs that are perfect so far
            result = result.filter(e => e.total_retries === 0);
            result.sort((a, b) => b.score - a.score || a.total_tokens - b.total_tokens);
        } else if (track === 'MINIMALIST') {
            // Efficiency comparisons only valid for completed missions
            result = result.filter(e => e.is_complete);
            result.sort((a, b) => a.total_tokens - b.total_tokens || b.score - a.score);
        } else if (track === 'BLITZ') {
            // Speed comparisons only valid for completed missions
            result = result.filter(e => e.is_complete);
            result.sort((a, b) => a.total_duration_seconds - b.total_duration_seconds || b.score - a.score);
        } else {
            // Elite: Pure score, partial progress allowed
            result.sort((a, b) => b.score - a.score || a.total_tokens - b.total_tokens);
        }

        return result.map((e, idx) => ({ ...e, displayRank: idx + 1 }));
    }, [entries, track]);

    const phaseRankings = React.useMemo(() => {
        if (track !== 'PHASES') return null;

        const getSorted = (phaseKey: string) => {
            return [...entries]
                .filter(e => e.phase_scores && e.phase_scores[phaseKey] !== undefined)
                .sort((a, b) => (b.phase_scores[phaseKey] || 0) - (a.phase_scores[phaseKey] || 0))
                .slice(0, 10);
        };

        return {
            p1: getSorted('1'),
            p2: getSorted('2'),
            p3: getSorted('3')
        };
    }, [entries, track]);

    const topThree = processedEntries.slice(0, 3);
    const others = processedEntries.slice(3);

    const getTrackDescription = () => {
        switch (track) {
            case 'ELITE': return "The highest overall mission efficacy scores.";
            case 'LEGENDS': return "Perfect records: Teams with zero tactical retries.";
            case 'MINIMALIST': return "Payload efficiency: Lowest total token expenditure.";
            case 'PHASES': return "Inter-phase performance analysis: Top tactical execution per sector.";
            case 'BLITZ': return "Strategic pace: Fastest mission completion times.";
        }
    };

    const getDetailHeader = () => {
        switch (track) {
            case 'ELITE': return 'Tactical Retries';
            case 'LEGENDS': return 'Payload (Tokens)';
            case 'MINIMALIST': return 'Payload (Tokens)';
            case 'BLITZ': return 'Assessment Score';
            default: return 'Detail';
        }
    };

    const getRankClass = (rank: number) => {
        if (rank === 1) return 'leaderboard__row-rank--1';
        if (rank === 2) return 'leaderboard__row-rank--2';
        if (rank === 3) return 'leaderboard__row-rank--3';
        return 'leaderboard__row-rank--default';
    };

    const handleBack = () => {
        navigate(-1);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="leaderboard">
            <div className="leaderboard__container animate-fadeIn">
                {/* Header */}
                <div className="leaderboard__header">
                    <button onClick={handleBack} className="leaderboard__back-btn btn-secondary">
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
                            Global Tactical Assessment • {entries.length} Measured Missions
                        </p>
                    </div>
                    <div className="leaderboard__spacer" />
                </div>

                {/* TRACK SELECTOR */}
                <div className="leaderboard__tracks-section">
                    <div className="leaderboard__tracks">
                        <button
                            className={`leaderboard__track-btn ${track === 'ELITE' ? 'leaderboard__track-btn--active' : ''}`}
                            onClick={() => setTrack('ELITE')}
                        >
                            <Icons.Trophy /> Elite Score
                        </button>
                        <button
                            className={`leaderboard__track-btn ${track === 'LEGENDS' ? 'leaderboard__track-btn--active' : ''}`}
                            onClick={() => setTrack('LEGENDS')}
                        >
                            <Icons.Check /> No-Retry Legends
                        </button>
                        <button
                            className={`leaderboard__track-btn ${track === 'MINIMALIST' ? 'leaderboard__track-btn--active' : ''}`}
                            onClick={() => setTrack('MINIMALIST')}
                        >
                            <Icons.Activity /> Minimalist
                        </button>
                        <button
                            className={`leaderboard__track-btn ${track === 'BLITZ' ? 'leaderboard__track-btn--active' : ''}`}
                            onClick={() => setTrack('BLITZ')}
                        >
                            <Icons.Zap /> Strategic Speed
                        </button>
                        <button
                            className={`leaderboard__track-btn ${track === 'PHASES' ? 'leaderboard__track-btn--active' : ''}`}
                            onClick={() => setTrack('PHASES')}
                        >
                            <Icons.Activity /> Tactical Breakdown
                        </button>
                    </div>
                    <p className="leaderboard__track-desc">{getTrackDescription()}</p>
                </div>

                {/* Podium Section (Top 3) - Only for non-phase view */}
                {track !== 'PHASES' && topThree.length > 0 && (
                    <div className="leaderboard__podium">
                        {/* 2nd Place */}
                        {topThree[1] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--2 glass-card animate-slideUp stagger-1 reactive-border">
                                <div className="leaderboard__podium-icon"><Icons.Trophy /></div>
                                <div className="leaderboard__podium-rank">2nd Division</div>
                                <div className="leaderboard__podium-team">{topThree[1].team_id}</div>
                                <div className="leaderboard__podium-usecase">{topThree[1].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--2">{track === 'BLITZ' ? formatDuration(topThree[1].total_duration_seconds) : topThree[1].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta">{track === 'MINIMALIST' ? `${topThree[1].total_tokens} TOKENS` : `${topThree[1].total_retries} RETRIES`}</div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {topThree[0] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--1 glass-card animate-reveal-up reactive-border reactive-border--intense">
                                <div className="leaderboard__podium-icon leaderboard__podium-icon--1"><Icons.Trophy /></div>
                                <div className="leaderboard__podium-badge">
                                    <Icons.Trophy /> {track === 'ELITE' ? 'Apex Leader' : track === 'LEGENDS' ? 'Perfect Record' : track === 'MINIMALIST' ? 'Token Master' : 'Speed Demon'}
                                </div>
                                <div className="leaderboard__podium-team leaderboard__podium-team--1">{topThree[0].team_id}</div>
                                <div className="leaderboard__podium-usecase leaderboard__podium-usecase--1">{topThree[0].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--1">{track === 'BLITZ' ? formatDuration(topThree[0].total_duration_seconds) : topThree[0].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta leaderboard__podium-meta--1">{track === 'MINIMALIST' ? `${topThree[0].total_tokens} TOKENS` : `${topThree[0].total_retries} RETRIES`}</div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {topThree[2] && (
                            <div className="leaderboard__podium-card leaderboard__podium-card--3 glass-card animate-slideUp stagger-2 reactive-border">
                                <div className="leaderboard__podium-icon"><Icons.Trophy /></div>
                                <div className="leaderboard__podium-rank">3rd Division</div>
                                <div className="leaderboard__podium-team">{topThree[2].team_id}</div>
                                <div className="leaderboard__podium-usecase">{topThree[2].usecase}</div>
                                <div className="leaderboard__podium-score leaderboard__podium-score--3">{track === 'BLITZ' ? formatDuration(topThree[2].total_duration_seconds) : topThree[2].score.toFixed(0)}</div>
                                <div className="leaderboard__podium-meta">{track === 'MINIMALIST' ? `${topThree[2].total_tokens} TOKENS` : `${topThree[2].total_retries} RETRIES`}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content Area */}
                <div className="leaderboard__list glass-panel animate-fadeIn stagger-3 reactive-border">
                    {track !== 'PHASES' && (
                        <div className="leaderboard__list-header">
                            <div className="leaderboard__list-header-pos">Pos</div>
                            <div>Operational Entity</div>
                            <div className="leaderboard__list-header-tokens">{getDetailHeader()}</div>
                            <div className="leaderboard__list-header-score">{track === 'BLITZ' ? 'Execution Time' : 'Efficiency Score'}</div>
                            <div className="leaderboard__list-header-status">Status</div>
                        </div>
                    )}

                    {track === 'PHASES' && phaseRankings ? (
                        <div className="leaderboard__phase-columns">
                            {[
                                { title: 'Sector 01: Strategy', data: phaseRankings.p1, key: '1' },
                                { title: 'Sector 02: Execution', data: phaseRankings.p2, key: '2' },
                                { title: 'Sector 03: Growth', data: phaseRankings.p3, key: '3' }
                            ].map((col) => (
                                <div key={col.key} className="leaderboard__phase-col">
                                    <div className="leaderboard__phase-col-header">{col.title}</div>
                                    <div className="leaderboard__phase-col-list">
                                        {col.data.length === 0 ? (
                                            <div className="leaderboard__phase-col-empty">No secure data available</div>
                                        ) : (
                                            col.data.map((entry, idx) => (
                                                <div key={entry.team_id} className={`leaderboard__phase-row ${entry.team_id === currentTeamId ? 'leaderboard__phase-row--current' : ''}`}>
                                                    <span className="leaderboard__phase-row-rank">{(idx + 1).toString().padStart(2, '0')}</span>
                                                    <span className="leaderboard__phase-row-team">{entry.team_id}</span>
                                                    <span className="leaderboard__phase-row-score">{(entry.phase_scores[col.key] || 0).toFixed(0)}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : processedEntries.length === 0 ? (
                        <div className="leaderboard__empty">
                            <div className="leaderboard__empty-icon"><Icons.Trophy /></div>
                            <h3 className="leaderboard__empty-title">Sector Quiet</h3>
                            <p className="leaderboard__empty-text">No teams found matching these tactical criteria.</p>
                        </div>
                    ) : (
                        <div className="leaderboard__list-body custom-scrollbar">
                            {(track === 'ELITE' || track === 'LEGENDS' || track === 'MINIMALIST' || track === 'BLITZ' ? others : processedEntries).map((entry) => {
                                const isCurrentTeam = entry.team_id === currentTeamId;
                                const isTopThree = entry.displayRank <= 3 && track !== 'PHASES';

                                return (
                                    <div
                                        key={entry.team_id}
                                        className={`leaderboard__row ${isCurrentTeam ? 'leaderboard__row--current' : ''}`}
                                    >
                                        <div className={`leaderboard__row-rank ${getRankClass(entry.displayRank)}`}>
                                            {entry.displayRank.toString().padStart(2, '0')}
                                        </div>

                                        <div className="leaderboard__row-info">
                                            <div className="leaderboard__row-team-row">
                                                <span className="leaderboard__row-team">{entry.team_id}</span>
                                                {isCurrentTeam && (
                                                    <span className="leaderboard__current-badge">
                                                        <Icons.Activity /> Team
                                                    </span>
                                                )}
                                            </div>
                                            <div className="leaderboard__row-usecase">{entry.usecase}</div>
                                        </div>

                                        <div className="leaderboard__row-tokens">
                                            {track === 'MINIMALIST' || track === 'LEGENDS' ? (
                                                <>{entry.total_tokens.toLocaleString()} <span className="leaderboard__row-tokens-unit">tk</span></>
                                            ) : track === 'BLITZ' ? (
                                                <>{entry.score.toFixed(0)} <span className="leaderboard__row-tokens-unit">pts</span></>
                                            ) : (
                                                <>{entry.total_retries} <span className="leaderboard__row-tokens-unit">retries</span></>
                                            )}
                                        </div>

                                        <div className={`leaderboard__row-score ${isTopThree ? 'leaderboard__row-score--top' : 'leaderboard__row-score--default'}`}>
                                            {track === 'BLITZ' ? formatDuration(entry.total_duration_seconds) : entry.score.toFixed(0)}
                                        </div>

                                        <div className="leaderboard__row-status">
                                            {entry.is_complete ? (
                                                <div className="leaderboard__status-badge leaderboard__status-badge--complete">
                                                    <Icons.Check /> Complete
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
                    <p className="leaderboard__footer-text">Encrypted Data Link • Tactical-v2.1.0</p>
                    <p className="leaderboard__footer-time">Sync: {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        </div>
    );
};
