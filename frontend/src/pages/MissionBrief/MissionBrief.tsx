import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
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
    )
};

export const MissionBrief: React.FC<MissionBriefProps> = ({ usecase, phases }) => {
    const navigate = useNavigate();
    const { startPhase } = useApp();
    const phaseList = Object.values(phases);

    const handleStart = async () => {
        await startPhase(1);
        navigate('/war-room');
    };

    return (
        <div className="mission-brief war-room-bg">
            <div className="mission-brief__viewport">
                {/* Top: Title & Tags */}
                <div className="mission-brief__header">
                    <h1 className="mission-brief__title">{usecase.title}</h1>
                    <div className="mission-brief__tags">
                        <span className="mission-brief__tag">{usecase.domain}</span>
                        <span className="mission-brief__tag">{usecase.target_market}</span>
                    </div>
                </div>

                {/* Middle: Grid */}
                <div className="mission-brief__grid">
                    {/* Left: Mission Context */}
                    <div className="mission-brief__panel mission-brief__panel--mission">
                        <div className="mission-brief__panel-header">
                            <Icons.Target />
                            <span>Mission Parameters</span>
                        </div>
                        <div className="mission-brief__content">
                            <p className="mission-brief__mission-text">
                                {usecase.description || `Your team must craft a compelling pitch strategy for the ${usecase.target_market} market within the ${usecase.domain} domain.`}
                            </p>

                            <div className="mission-brief__directives">
                                <div className="mission-brief__directive">
                                    <div className="mission-brief__directive-dot" />
                                    <span>Synthesize strategic narrative components</span>
                                </div>
                                <div className="mission-brief__directive">
                                    <div className="mission-brief__directive-dot" />
                                    <span>Optimize for stakeholder resonance</span>
                                </div>
                                <div className="mission-brief__directive">
                                    <div className="mission-brief__directive-dot" />
                                    <span>Generate high-fidelity visual assets</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Engagement Protocol (Rules) */}
                    <div className="mission-brief__panel mission-brief__panel--rules">
                        <div className="mission-brief__panel-header">
                            <Icons.Shield />
                            <span>Engagement Protocol</span>
                        </div>
                        <div className="mission-brief__protocol-list">
                            <div className="mission-brief__protocol-item">
                                <div className="mission-brief__protocol-label">Performance</div>
                                <div className="mission-brief__protocol-desc">Minimum 70% accuracy required based on insight quality.</div>
                            </div>
                            <div className="mission-brief__protocol-item">
                                <div className="mission-brief__protocol-label">Time Penalty</div>
                                <div className="mission-brief__protocol-desc">-10 PTS per 10-minute block exceeding the limit.</div>
                            </div>
                            <div className="mission-brief__protocol-item">
                                <div className="mission-brief__protocol-label">Strategic Costs</div>
                                <div className="mission-brief__protocol-desc">-50 PTS per retry. Hints incur deductions.</div>
                            </div>
                            <div className="mission-brief__protocol-item">
                                <div className="mission-brief__protocol-label">Efficiency Bonus</div>
                                <div className="mission-brief__protocol-desc">+5% Score bonus for staying within optimal token limits.</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Phase Timeline */}
                    <div className="mission-brief__panel mission-brief__panel--phases">
                        <div className="mission-brief__panel-header">
                            <span>Execution Phases</span>
                        </div>
                        <div className="mission-brief__phase-list">
                            {phaseList.map((phase, idx) => (
                                <div key={phase.id} className="mission-brief__phase-item">
                                    <div className="mission-brief__phase-num">{idx + 1}</div>
                                    <div className="mission-brief__phase-content">
                                        <div className="mission-brief__phase-name">{phase.name}</div>
                                        <div className="mission-brief__phase-meta">
                                            {phase.questions?.length || 0} questions • {Math.floor((phase.time_limit_seconds || 600) / 60)}m
                                        </div>
                                    </div>
                                    <div className="mission-brief__phase-weight">{Math.round((phase.weight || 0.33) * 100)}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom: Launch */}
                <div className="mission-brief__footer">
                    <button onClick={handleStart} className="mission-brief__launch-btn">
                        <Icons.Rocket /> Launch Mission
                    </button>
                    <p className="mission-brief__status">Systems ready • AI synthesis active</p>
                </div>
            </div>
        </div>
    );
};
