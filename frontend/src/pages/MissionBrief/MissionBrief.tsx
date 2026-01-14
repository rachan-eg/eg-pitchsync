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
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    ),
    Rocket: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" /><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" /></svg>
    )
};

export const MissionBrief: React.FC<MissionBriefProps> = ({ usecase, phases }) => {
    const navigate = useNavigate();
    const { startPhase } = useApp();
    const phaseList = Object.values(phases);

    const getComplexityClass = (complexity: string) => {
        switch (complexity) {
            case 'High': return 'mission-brief__complexity--high';
            case 'Medium': return 'mission-brief__complexity--medium';
            default: return 'mission-brief__complexity--low';
        }
    };

    const handleStart = async () => {
        await startPhase(1);
        navigate('/war-room');
    };

    return (
        <div className="mission-brief war-room-bg">

            <div className="mission-brief__container animate-fadeIn custom-scrollbar">
                {/* Project Header */}
                <div className="mission-brief__header animate-slideUp">
                    <h1 className="mission-brief__title">
                        {usecase.title}
                    </h1>
                    <p className="mission-brief__description">
                        {usecase.description || `Challenge: Build a compelling pitch for the ${usecase.target_market} market.`}
                    </p>
                </div>

                {/* Details Grid */}
                <div className="mission-brief__grid">
                    {/* Left: Use Case Info */}
                    <div className="mission-brief__panel glass-card animate-fadeIn">
                        <h3 className="mission-brief__panel-title">Strategic Guidelines</h3>

                        <div className="mission-brief__info-list">
                            <div className="mission-brief__info-row">
                                <span className="mission-brief__info-label">Domain</span>
                                <span className="mission-brief__info-value">{usecase.domain}</span>
                            </div>
                            <div className="mission-brief__info-row">
                                <span className="mission-brief__info-label">Target Market</span>
                                <span className="mission-brief__info-value mission-brief__info-value--truncate">{usecase.target_market}</span>
                            </div>
                            <div className="mission-brief__info-row">
                                <span className="mission-brief__info-label">Complexity</span>
                                <span className={getComplexityClass(usecase.complexity)}>
                                    {usecase.complexity}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Phase Overview */}
                    <div className="mission-brief__panel glass-card animate-fadeIn stagger-1">
                        <h3 className="mission-brief__panel-title">Execution Milestones</h3>

                        <div className="mission-brief__phase-list">
                            {phaseList.map((phase, idx) => (
                                <div key={phase.id} className="mission-brief__phase-item">
                                    <div className="mission-brief__phase-number">
                                        {idx + 1}
                                    </div>
                                    <div className="mission-brief__phase-info">
                                        <div className="mission-brief__phase-name">{phase.name}</div>
                                        <div className="mission-brief__phase-meta">
                                            {phase.questions?.length || 0} reqs • {Math.floor((phase.time_limit_seconds || 600) / 60)}m
                                        </div>
                                    </div>
                                    <div className="mission-brief__phase-weight">
                                        {Math.round((phase.weight || 0.33) * 100)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>


                {/* Start Button */}
                <div className="mission-brief__actions animate-fadeIn stagger-3">
                    <button
                        onClick={handleStart}
                        className="mission-brief__launch-btn btn-primary"
                    >
                        <Icons.Rocket /> Launch Project
                    </button>
                    <p className="mission-brief__status">
                        AI synthesis active • All systems ready
                    </p>
                </div>
            </div>
        </div>
    );
};
