import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import type { SessionState } from '../../types';
import './FinalReveal.css';

interface FinalRevealProps {
    session: SessionState;
    imageUrl: string;
}

const Icons = {
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    ),
    Mic: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    )
};

export const FinalReveal: React.FC<FinalRevealProps> = ({ session, imageUrl }) => {
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

    // Calculate penalties (clamp negative time penalty to 0 for old speed bonus data)
    const timePenalty = Math.max(0, Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.time_penalty || 0), 0)));
    const hintPenalty = Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.hint_penalty || 0), 0));
    const retryPenalty = Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.retry_penalty || 0), 0));
    const retryCount = Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.retries || 0), 0);

    return (
        <div className="final-reveal">
            <div className="final-reveal__container">

                {/* Header */}
                <header className="final-reveal__header animate-slideUp">
                    <div className="final-reveal__header-left">
                        <button className="final-reveal__back-btn btn-secondary" onClick={() => navigate('/curate')}>
                            <Icons.ChevronLeft /> BACK TO CURATION
                        </button>
                    </div>
                    <div className="final-reveal__title-group">
                        <span className="final-reveal__subtitle">Mission Complete</span>
                        <h1 className="final-reveal__title">{tier.name}</h1>
                    </div>
                    <div className="final-reveal__header-right" />
                </header>

                <main className="final-reveal__layout">

                    {/* Image Section */}
                    <section className="final-reveal__visual-deck animate-fadeIn stagger-1">
                        <div className="final-reveal__image-frame">
                            <div className="final-reveal__corner final-reveal__corner--tl" />
                            <div className="final-reveal__corner final-reveal__corner--tr" />
                            <div className="final-reveal__corner final-reveal__corner--bl" />
                            <div className="final-reveal__corner final-reveal__corner--br" />

                            <div className="final-reveal__image-container">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="Pitch Vision" className="final-reveal__image" />
                                ) : (
                                    <div className="final-reveal__image-placeholder">IMAGE NOT AVAILABLE</div>
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
                                <Icons.Mic /> BEGIN PRESENTATION
                            </button>
                            <button className="btn-secondary" onClick={() => window.print()} title="Export">
                                <Icons.Download />
                            </button>
                        </div>
                    </section>

                    {/* Intelligence Panel */}
                    <aside className="final-reveal__intelligence animate-fadeIn stagger-2">

                        {/* Score Card */}
                        <div className="final-reveal__grade-card">
                            <div className="final-reveal__score-big">
                                <span className="final-reveal__score-val">{Math.round(session.total_score)}</span>
                                <span className="final-reveal__score-label">Performance Score</span>
                            </div>
                            <div className={`final-reveal__tier-seal ${tier.class}`}>
                                {tier.label}
                            </div>
                        </div>

                        <div className="final-reveal__panels">
                            {/* Phase Scores */}
                            <div className="final-reveal__panel">
                                <h3 className="final-reveal__panel-title">Phase Performance</h3>
                                <div className="final-reveal__results-list">
                                    {Object.entries(session.phase_scores).map(([name, score]) => {
                                        const pDef = Object.values(phaseConfig).find(p => p.name === name);
                                        const maxScore = Math.round(1000 * (pDef?.weight || 0.33));
                                        return (
                                            <div key={name} className="final-reveal__result-item">
                                                <div className="final-reveal__result-meta">
                                                    <span className="final-reveal__phase-label">{name.replace('Phase ', '')}</span>
                                                    <span className="final-reveal__phase-score">{Math.round(score)}/{maxScore} <small>PTS</small></span>
                                                </div>
                                                <div className="final-reveal__result-bar">
                                                    <div className="final-reveal__result-fill" style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="final-reveal__sub-section">
                                    <h4 className="final-reveal__sub-title">Context</h4>
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

                            {/* Visual Forensics Panel - NEW */}
                            <div className="final-reveal__panel" style={{ borderColor: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.03)' }}>
                                <h3 className="final-reveal__panel-title" style={{ color: 'var(--accent)' }}>Visual Intelligence</h3>
                                <div className="final-reveal__metrics-group">
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">VISUAL ALIGNMENT</span>
                                        <span className="final-reveal__stat-value" style={{
                                            color: session.final_output.visual_alignment === 'High' ? 'var(--success)' :
                                                session.final_output.visual_alignment === 'Critical Mismatch' ? 'var(--danger)' : 'var(--warning)'
                                        }}>
                                            {session.final_output.visual_alignment || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">EVIDENCE SCORE</span>
                                        <span className="final-reveal__stat-value">
                                            {typeof session.final_output.visual_score === 'number'
                                                ? Math.round(session.final_output.visual_score * 100)
                                                : '0'}/100
                                        </span>
                                    </div>
                                    {session.final_output.visual_feedback && (
                                        <div className="final-reveal__feedback-box" style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic' }}>
                                            "{session.final_output.visual_feedback}"
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="final-reveal__panel">
                                <h3 className="final-reveal__panel-title">Efficiency Metrics</h3>

                                <div className="final-reveal__metrics-group">
                                    <div className="final-reveal__metrics-sub">Resources</div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">TEAM</span>
                                        <span className="final-reveal__stat-value">{session.team_id}</span>
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">AI TOKENS</span>
                                        <span className="final-reveal__stat-value" style={{ color: 'var(--primary)' }}>{totalTokens.total.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="final-reveal__metrics-group">
                                    <div className="final-reveal__metrics-sub">Deductions</div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">TIME PENALTY</span>
                                        <span className="final-reveal__stat-value" style={{ color: timePenalty > 0 ? 'var(--warning)' : 'var(--text-dim)' }}>
                                            {timePenalty > 0 ? `-${timePenalty}` : '0'} <small>PTS</small>
                                        </span>
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">HINT PENALTY</span>
                                        <span className="final-reveal__stat-value" style={{ color: hintPenalty > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                                            {hintPenalty > 0 ? `-${hintPenalty}` : '0'} <small>PTS</small>
                                        </span>
                                    </div>
                                    <div className="final-reveal__stat-row">
                                        <span className="final-reveal__stat-label">RETRIES</span>
                                        <span className="final-reveal__stat-value" style={{ color: retryPenalty > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                                            {/* {retryCount} ({retryPenalty > 0 ? `-${retryPenalty}` : '0'} <small>PTS</small>) */}
                                            {retryCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
};
