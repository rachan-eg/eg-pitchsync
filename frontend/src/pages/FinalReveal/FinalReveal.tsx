import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import type { SessionState } from '../../types';
import './FinalReveal.css';

interface FinalRevealProps {
    session: SessionState;
    imageUrl: string;
    promptUsed: string;
}

const Icons = {
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    ),
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" /></svg>
    ),
    Mic: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
    ),
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><polyline points="21 3 21 8 16 8" /></svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    ),
    Terminal: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
    )
};

export const FinalReveal: React.FC<FinalRevealProps> = ({
    session,
    imageUrl,
    promptUsed
}) => {
    const navigate = useNavigate();
    const { totalTokens, phaseConfig } = useApp();

    const getScoreTier = (score: number) => {
        if (score >= 900) return { label: 'S', name: 'S-TIER', class: 'final-reveal__tier-seal--s' };
        if (score >= 800) return { label: 'A', name: 'A-TIER', class: 'final-reveal__tier-seal--a' };
        if (score >= 700) return { label: 'B', name: 'B-TIER', class: 'final-reveal__tier-seal--b' };
        if (score >= 500) return { label: 'C', name: 'C-TIER', class: 'final-reveal__tier-seal--c' };
        return { label: 'D', name: 'D-TIER', class: 'final-reveal__tier-seal--default' };
    };

    const tier = getScoreTier(session.total_score);

    return (
        <div className="final-reveal">
            <div className="final-reveal__container">

                {/* Header */}
                <header className="final-reveal__header animate-slideUp">
                    <div className="final-reveal__header-left">
                        <button
                            className="final-reveal__back-btn btn-secondary"
                            onClick={() => navigate('/curate')}
                        >
                            <Icons.ChevronLeft /> RETURN TO CURATION
                        </button>
                    </div>
                    <div className="final-reveal__title-group">
                        <span className="final-reveal__subtitle">Mission Evaluation Complete</span>
                        <h1 className="final-reveal__title">Analysis Result: {tier.name}</h1>
                    </div>
                    <div className="final-reveal__header-right">
                        {/* Timestamp removed */}
                    </div>
                </header>

                <main className="final-reveal__layout">

                    {/* Visual Deck */}
                    <section className="final-reveal__visual-deck animate-fadeIn stagger-1">
                        <div className="final-reveal__image-frame">
                            <div className="final-reveal__corner final-reveal__corner--tl" />
                            <div className="final-reveal__corner final-reveal__corner--tr" />
                            <div className="final-reveal__corner final-reveal__corner--bl" />
                            <div className="final-reveal__corner final-reveal__corner--br" />

                            <div className="final-reveal__image-container">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="Generated Pitch Vision" className="final-reveal__image" />
                                ) : (
                                    <div className="final-reveal__image-placeholder">NEURAL LINK ERROR: VISUAL DATA NOT FOUND</div>
                                )}
                                <div className="final-reveal__image-overlay" />
                            </div>
                        </div>

                        <div className="final-reveal__action-bar">
                            <button
                                className="final-reveal__present-btn btn-primary animate-flicker"
                                onClick={() => navigate('/present')}
                                disabled={!imageUrl}
                            >
                                <Icons.Mic /> BEGIN EXECUTIVE PRESENTATION
                            </button>
                            <button className="btn-secondary" onClick={() => window.print()} title="Export Intelligence">
                                <Icons.Download />
                            </button>
                        </div>
                    </section>

                    {/* Intelligence Section */}
                    <aside className="final-reveal__intelligence animate-fadeIn stagger-2">

                        {/* Grade Card */}
                        <div className="final-reveal__grade-card">
                            <div className="final-reveal__score-big">
                                <span className="final-reveal__score-val">{Math.round(session.total_score)}</span>
                                <span className="final-reveal__score-label">Objective Performance Score</span>
                            </div>
                            <div className={`final-reveal__tier-seal ${tier.class}`}>
                                {tier.label}
                            </div>
                        </div>

                        <div className="final-reveal__panels">
                            {/* Mission Performance & Alignment */}
                            <div className="final-reveal__panel">
                                <h3 className="final-reveal__panel-title">Operational Excellence</h3>
                                <div className="final-reveal__results-list">
                                    {Object.entries(session.phase_scores).map(([name, score]) => {
                                        const pDef = Object.values(phaseConfig).find(p => p.name === name);
                                        const weight = pDef?.weight || 0.33;
                                        const maxScore = Math.round(1000 * weight);

                                        return (
                                            <div key={name} className="final-reveal__result-item">
                                                <div className="final-reveal__result-meta">
                                                    <span className="final-reveal__phase-label">{name.replace('Phase ', '')}</span>
                                                    <span className="final-reveal__phase-score">{Math.round(score)} / {maxScore} <small>PTS</small></span>
                                                </div>
                                                <div className="final-reveal__result-bar">
                                                    <div className="final-reveal__result-fill" style={{ width: `${(score / maxScore) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="final-reveal__sub-section">
                                    <h4 className="final-reveal__sub-title">Strategic Context</h4>
                                    <div className="final-reveal__brief">
                                        <div className="final-reveal__brief-item">
                                            <label>DOMAIN</label>
                                            <span>{session.usecase.domain}</span>
                                        </div>
                                        <div className="final-reveal__brief-item">
                                            <label>SCENARIO</label>
                                            <span>{session.usecase.title}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resource Metrics */}
                            <div className="final-reveal__panel">
                                <h3 className="final-reveal__panel-title">Resource & Efficiency</h3>

                                <div className="final-reveal__metrics-group">
                                    <div className="final-reveal__metrics-sub">Mission Identity</div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">TEAM_ID</span>
                                        <span className="final-reveal__stat-value">{session.team_id}</span>
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">AI_RESOURCE_USAGE</span>
                                        <span className="final-reveal__stat-value" style={{ color: 'var(--primary)' }}>{totalTokens.total.toLocaleString()} <small>TOKENS</small></span>
                                    </div>
                                </div>

                                <div className="final-reveal__metrics-group" style={{ marginTop: '1rem' }}>
                                    <div className="final-reveal__metrics-sub">Efficiency Deductions</div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">TIME OVERAGE</span>
                                        {(() => {
                                            const val = Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.time_penalty || 0), 0));
                                            return <span className="final-reveal__stat-value" style={{ color: 'var(--warning)' }}>{val > 0 ? `-${val}` : val} <small>PTS</small></span>;
                                        })()}
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">HINT USAGE</span>
                                        {(() => {
                                            const val = Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.hint_penalty || 0), 0));
                                            return <span className="final-reveal__stat-value" style={{ color: 'var(--danger)' }}>{val > 0 ? `-${val}` : val} <small>PTS</small></span>;
                                        })()}
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">RETRY OVERHEAD</span>
                                        {(() => {
                                            const attempts = Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.retries || 0), 0);
                                            const penalty = Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.retry_penalty || 0), 0));
                                            return (
                                                <span className="final-reveal__stat-value" style={{ color: 'var(--danger)' }}>
                                                    {attempts} ATTEMPTS / {penalty > 0 ? `-${penalty}` : penalty} <small>PTS</small>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </main>

                <footer className="final-reveal__footer animate-fadeIn stagger-3">
                    <div className="final-reveal__console">
                        <div className="final-reveal__console-header">
                            <div className="final-reveal__console-title"><Icons.Terminal /> NEURAL_IMAGE_MANIFEST.LOG</div>
                            <div className="final-reveal__console-status">READ_ONLY</div>
                        </div>
                        <div className="final-reveal__console-body custom-scrollbar">
                            {promptUsed}
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};
