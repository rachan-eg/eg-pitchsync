import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import { useAuth } from '../../providers';
import type { UseCase, Theme, PhaseDefinition } from '../../types';
import './MissionBrief.css';

interface MissionBriefProps {
    usecase: UseCase;
    theme: Theme;
    phases: Record<number, PhaseDefinition>;
}

const Icons = {
    Rocket: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" /><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" /></svg>
    ),
    Target: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
    ),
    Shield: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    ),
    ArrowLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    ),
    Activity: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    )
};

export const MissionBrief: React.FC<MissionBriefProps> = ({ usecase, phases }) => {
    const navigate = useNavigate();
    const { startPhase, resetToStart, loading, session, highestUnlockedPhase } = useApp();
    const { clearTeamCode } = useAuth();
    const [activePanel, setActivePanel] = React.useState<'mission' | 'rules' | 'phases' | null>(null);
    const [isInteractionReady, setIsInteractionReady] = React.useState(false);

    React.useEffect(() => {
        // Prevent accidental hover activation on immediate load
        const timer = setTimeout(() => setIsInteractionReady(true), 800);
        return () => clearTimeout(timer);
    }, []);

    const handlePanelHover = (panel: 'mission' | 'rules' | 'phases') => {
        if (isInteractionReady) {
            setActivePanel(panel);
        }
    };

    const phaseList = Object.values(phases);
    const totalPhases = phaseList.length;

    const isComplete = session?.is_complete || highestUnlockedPhase > totalPhases;
    const isStarted = highestUnlockedPhase > 1;

    const handleStart = async () => {
        if (isComplete) {
            navigate('/curate');
            return;
        }
        await startPhase(session?.current_phase || 1);
        navigate('/war-room');
    };

    const handleBackToTeamCode = () => {
        resetToStart();
        clearTeamCode();
        navigate('/team-code', { replace: true });
    };

    return (
        <div className="mission-brief war-room-bg">
            <div className="mission-brief__viewport">
                {/* Top: Title & Tags */}
                <div className="mission-brief__header">
                    <div className="mission-brief__team-label">Team: {session?.team_id}</div>
                    <h1 className="mission-brief__title">{usecase.title}</h1>
                    {/* <div className="mission-brief__tags">
                        <span className="mission-brief__tag">{usecase.domain}</span>
                        <span className="mission-brief__tag">{usecase.target_market}</span>
                    </div> */}
                </div>

                {/* Middle: Grid */}
                <div className="mission-brief__grid">
                    {/* Left: Mission Context */}
                    <div
                        className={`mission-brief__panel mission-brief__panel--mission ${activePanel === 'mission' ? 'active' : ''} ${activePanel && activePanel !== 'mission' ? 'inactive' : ''}`}
                        onMouseEnter={() => handlePanelHover('mission')}
                        onMouseLeave={() => setActivePanel(null)}
                    >
                        <div className="mission-brief__panel-header">
                            <Icons.Target />
                            <span>Mission Parameters</span>
                        </div>

                        <div className="mission-brief__panel-content">
                            <div className="mission-brief__summary">
                                <div className="mission-brief__summary-stat">
                                    <span className="label">Domain</span>
                                    <span className="value">{usecase.domain}</span>
                                </div>
                                <div className="mission-brief__summary-stat">
                                    <span className="label">Target Market</span>
                                    <span className="value">{usecase.target_market}</span>
                                </div>
                                <div className="mission-brief__summary-stat">
                                    <span className="label">Description</span>
                                    <span className="value">{usecase.description}</span>
                                </div>
                            </div>

                            <div className="mission-brief__detail">
                                <p className="mission-brief__mission-text">
                                    {usecase.description || `Your team must craft a compelling pitch strategy for the ${usecase.target_market} market within the ${usecase.domain} domain.`}
                                </p>

                                <div className="mission-brief__directives">
                                    <div className="mission-brief__directive">
                                        <div className="mission-brief__directive-dot" />
                                        <span><strong>Feasibility First:</strong> Logic outweighs style. Evaluators ignore typos but punish "magic" solutions.</span>
                                    </div>
                                    <div className="mission-brief__directive">
                                        <div className="mission-brief__directive-dot" />
                                        <span><strong>Specifics &gt; Generics:</strong> "We use BERT-large" scores higher than "We use AI". Explain <em>how</em>.</span>
                                    </div>
                                    <div className="mission-brief__directive">
                                        <div className="mission-brief__directive-dot" />
                                        <span><strong>Reality Check:</strong> Optimism is suspicious. Acknowledging risks proves market maturity.</span>
                                    </div>
                                    <div className="mission-brief__directive">
                                        <div className="mission-brief__directive-dot" />
                                        <span><strong>Signal to Noise:</strong> Conciseness is currency. Validated metrics and hard facts beat "visionary" fluff.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Engagement Protocol (Rules) */}
                    <div
                        className={`mission-brief__panel mission-brief__panel--rules ${activePanel === 'rules' ? 'active' : ''} ${activePanel && activePanel !== 'rules' ? 'inactive' : ''}`}
                        onMouseEnter={() => handlePanelHover('rules')}
                        onMouseLeave={() => setActivePanel(null)}
                    >
                        <div className="mission-brief__panel-header">
                            <Icons.Shield />
                            <span>Engagement Protocol</span>
                        </div>

                        <div className="mission-brief__panel-content">
                            <div className="mission-brief__summary">
                                <div className="mission-brief__summary-row">
                                    <span className="label">Retries</span>
                                    <span className="value">Max 3</span>
                                </div>
                                <div className="mission-brief__summary-row">
                                    <span className="label">Time Penalty</span>
                                    <span className="value">-10 PTS / 10mins</span>
                                </div>
                                <div className="mission-brief__summary-row">
                                    <span className="label">Hint Penalty</span>
                                    <span className="value">-25 PTS</span>
                                </div>
                                <div className="mission-brief__summary-row">
                                    <span className="label">Efficiency Bonus</span>
                                    <span className="value">+5% Score</span>
                                </div>
                                <div className="mission-brief__summary-row highlight">
                                    <span className="label">Max Potential</span>
                                    <span className="value">1000 PTS</span>
                                </div>
                            </div>

                            <div className="mission-brief__detail">
                                <div className="mission-brief__protocol-grid compact">
                                    <div className="mission-brief__protocol-card">
                                        <div className="card-lbl">RETRY LOGIC</div>
                                        <p>No penalty. Max 3 attempts allowed per phase.</p>
                                    </div>
                                    <div className="mission-brief__protocol-card">
                                        <div className="card-lbl">TIME DILATION</div>
                                        <p>-10 PTS for every 10m block of overtime. Speed preserves lead.</p>
                                    </div>
                                    <div className="mission-brief__protocol-card penalty">
                                        <div className="card-lbl">INTELLIGENCE DEBT</div>
                                        <p>-25 PTS penalty per hint. Use only when critically stalled.</p>
                                    </div>
                                    <div className="mission-brief__protocol-card bonus">
                                        <div className="card-lbl">SIGNAL BONUS</div>
                                        <p>+5% Bonus for concise responses (100-600 tokens).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Phase Timeline */}
                    <div
                        className={`mission-brief__panel mission-brief__panel--phases ${activePanel === 'phases' ? 'active' : ''} ${activePanel && activePanel !== 'phases' ? 'inactive' : ''}`}
                        onMouseEnter={() => handlePanelHover('phases')}
                        onMouseLeave={() => setActivePanel(null)}
                    >
                        <div className="mission-brief__panel-header">
                            <Icons.Activity />
                            <span>Execution Phases</span>
                        </div>

                        <div className="mission-brief__panel-content">
                            <div className="mission-brief__summary">
                                <div className="mission-brief__summary-header">Mission Timeline</div>
                                {phaseList.map((phase, idx) => (
                                    <div key={phase.id} className="mission-brief__summary-row">
                                        <span className="label">0{idx + 1}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span className="value">{phase.name}</span>
                                            <span style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)' }}>
                                                {Math.round(phase.weight * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div className="mission-brief__summary-row highlight">
                                    <span className="label">Est. Duration</span>
                                    <span className="value">~20 Minutes</span>
                                </div>
                            </div>

                            <div className="mission-brief__detail">
                                <div className="mission-brief__phase-list">
                                    {phaseList.map((phase, idx) => (
                                        <div key={phase.id} className="mission-brief__phase-item">
                                            <div className="mission-brief__phase-num">{idx + 1}</div>
                                            <div className="mission-brief__phase-content">
                                                <div className="mission-brief__phase-name">{phase.name}</div>
                                                <div className="mission-brief__phase-meta">
                                                    {phase.questions?.length || 0} tasks • {Math.floor((phase.time_limit_seconds || 600) / 60)}m limit
                                                </div>
                                                <div className="mission-brief__phase-desc">
                                                    {phase.description || "Complete core objectives to unlock next tier."}
                                                </div>
                                            </div>
                                            <div className="mission-brief__phase-weight">{Math.round((phase.weight || 0.33) * 100)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom: Launch */}
                <div className="mission-brief__footer">
                    <div className="mission-brief__footer-actions">
                        <button
                            onClick={handleBackToTeamCode}
                            className="btn-secondary mission-brief__back-btn"
                        >
                            <Icons.ArrowLeft /> Change Team
                        </button>
                        <button
                            onClick={handleStart}
                            className="btn-primary mission-brief__launch-btn"
                            disabled={loading}
                        >
                            {loading ? <div className="loading-spinner--small" /> : <Icons.Rocket />}
                            {loading ? 'Initializing...' : (isComplete || isStarted ? 'Go to Mission' : 'Launch Mission')}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
