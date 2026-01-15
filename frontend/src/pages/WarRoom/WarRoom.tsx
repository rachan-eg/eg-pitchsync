import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../AppContext';
import type { SessionState, PhaseDefinition } from '../../types';
import './WarRoom.css';

interface WarRoomProps {
    session: SessionState | null;
    phaseConfig: Record<number, PhaseDefinition>;
    children: React.ReactNode;
    highestUnlockedPhase?: number;
}

const Icons = {
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    Lock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    ),
    Activity: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    ),
    Terminal: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
    ),
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
    )
};

export const WarRoom: React.FC<WarRoomProps> = ({
    session,
    phaseConfig,
    children,
    highestUnlockedPhase = 1
}) => {
    const { totalTokens, startPhase, loading } = useApp();
    const navigate = useNavigate();
    const location = useLocation();

    if (!session) {
        return (
            <div className="war-room__loading">
                <div className="loading-spinner" />
                <div className="war-room__loading-text">ESTABLISHING UPLINK...</div>
            </div>
        );
    }

    const handlePhaseSelect = async (num: number) => {
        if (num > highestUnlockedPhase || loading || num === session.current_phase) return;
        await startPhase(num);
    };

    return (
        <div className="war-room animate-fade-in">
            {/* Tactical Sidebar */}
            <aside className="war-room__sidebar">
                <header className="war-room__sidebar-header">
                    <h3 className="war-room__sidebar-title">Mission Progress</h3>
                </header>

                <nav className="war-room__phases">
                    {Object.entries(phaseConfig).map(([num, phase]) => {
                        const phaseNum = parseInt(num);
                        const isActive = session.current_phase === phaseNum;
                        // Score check must be strictly ignoring undefined, as 0 is a valid score
                        const hasScore = session.phase_scores[phase.name] !== undefined;
                        const isCompleted = hasScore || session.current_phase > phaseNum;
                        const isLocked = phaseNum > highestUnlockedPhase;

                        return (
                            <button
                                key={phaseNum}
                                disabled={isLocked || loading}
                                onClick={() => handlePhaseSelect(phaseNum)}
                                className={`war-room__phase-btn ${isActive ? 'war-room__phase-btn--active' : ''} ${isCompleted ? 'war-room__phase-btn--completed' : ''}`}
                                title={isLocked ? 'Tactical Lock: Complete previous objectives' : `Switch to Phase 0${phaseNum}`}
                            >
                                <div className="war-room__phase-num">
                                    {isCompleted ? <Icons.Check /> : phaseNum}
                                </div>
                                <div className="war-room__phase-info">
                                    <div className="war-room__phase-label">Phase 0{phaseNum}</div>
                                    <div className="war-room__phase-name">{phase.name}</div>
                                </div>
                                {
                                    isCompleted && session.phase_scores[phase.name] !== undefined && (
                                        <div className="war-room__phase-score">
                                            {Math.round(session.phase_scores[phase.name])}
                                            <div className="war-room__phase-score-unit">PTS</div>
                                        </div>
                                    )
                                }
                                {isLocked && <Icons.Lock />}
                                {isActive && !isLocked && <div className="war-room__phase-active-indicator" />}
                            </button>
                        );
                    })}

                    {/* Phase Evaluation / Curation Buttons */}
                    {(() => {
                        const totalPhases = Object.keys(phaseConfig).length;
                        const isCurationUnlocked = highestUnlockedPhase > totalPhases;
                        const isRevealUnlocked = session.is_complete || !!session.final_output?.image_url;

                        const isCurateActive = location.pathname === '/curate';
                        const isRevealActive = location.pathname === '/reveal';

                        return (
                            <>
                                {/* Image Curation Phase */}
                                <button
                                    key="curate"
                                    disabled={!isCurationUnlocked}
                                    onClick={() => navigate('/curate')}
                                    className={`war-room__phase-btn war-room__phase-btn--final ${isCurateActive ? 'war-room__phase-btn--active' : ''} ${isCurationUnlocked ? 'war-room__phase-btn--completed' : ''}`}
                                    style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)' }}
                                    title={!isCurationUnlocked ? 'Locked: Complete all phases to unlock' : 'Visualize Pitch'}
                                >
                                    <div className="war-room__phase-num">
                                        <Icons.Sparkles />
                                    </div>
                                    <div className="war-room__phase-info">
                                        <div className="war-room__phase-label">Phase Final</div>
                                        <div className="war-room__phase-name">Vision Curation</div>
                                    </div>
                                    {!isCurationUnlocked && <Icons.Lock />}
                                    {isCurateActive && <div className="war-room__phase-active-indicator" />}
                                </button>

                                {/* Final Reveal Phase */}
                                <button
                                    key="reveal"
                                    disabled={!isRevealUnlocked}
                                    onClick={() => navigate('/reveal')}
                                    className={`war-room__phase-btn ${isRevealActive ? 'war-room__phase-btn--active' : ''} ${session.is_complete ? 'war-room__phase-btn--completed' : ''}`}
                                    style={{ borderColor: isRevealUnlocked ? 'rgba(139, 92, 246, 0.3)' : undefined, opacity: isRevealUnlocked ? 1 : 0.6 }}
                                    title={!isRevealUnlocked ? 'Locked: Submit your final pitch to unlock' : 'Mission Completion'}
                                >
                                    <div className="war-room__phase-num" style={{ background: isRevealUnlocked ? 'rgba(139, 92, 246, 0.2)' : undefined, color: isRevealUnlocked ? 'var(--primary)' : undefined }}>
                                        <Icons.Terminal />
                                    </div>
                                    <div className="war-room__phase-info">
                                        <div className="war-room__phase-label">Phase Reveal</div>
                                        <div className="war-room__phase-name">Final Validation</div>
                                    </div>
                                    {!isRevealUnlocked && <Icons.Lock />}
                                    {isRevealActive && <div className="war-room__phase-active-indicator" />}
                                </button>
                            </>
                        );
                    })()}
                </nav>

                <div className="war-room__metrics">
                    <header className="war-room__sidebar-header">
                        <h3 className="war-room__sidebar-title">Live Intelligence</h3>
                    </header>
                    <div className="war-room__metrics-grid">
                        <div className="war-room__metric-card">
                            <div className="war-room__metric-label">Team Designation</div>
                            <div className="war-room__metric-value">{session.team_id || 'ALPHA-1'}</div>
                        </div>
                        <div className="war-room__metric-card">
                            <div className="war-room__metric-label">AI Resource Usage</div>
                            <div className="war-room__metric-value" style={{ color: 'var(--primary)' }}>
                                {totalTokens.total.toLocaleString()}
                            </div>
                            <div className="war-room__metric-sub">
                                <span title="Strategic Payload Tokens">{totalTokens.payload} P</span>
                                <span style={{ margin: '0 4px' }}>|</span>
                                <span title="AI Agent Intelligence Tokens">{totalTokens.ai} A</span>
                            </div>
                        </div>

                    </div>
                </div>
            </aside>

            {/* Operation Center */}
            <main className="war-room__main">
                <div className="war-room__content">
                    {children}
                </div>
            </main>
        </div >
    );
};
