import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../AppContext';
import { getApiUrl } from '../../utils/api';
import type { SessionState, PitchSubmission } from '../../types';
import './FinalReveal.css';

interface FinalRevealProps {
    session: SessionState;
    imageUrl: string;
    selectedSubmission?: PitchSubmission | null;
    readOnly?: boolean;
    onBack?: () => void;
}

const Icons = {
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    ),
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    ),
    Mic: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    )
};

const SLIDE_INTERVAL = 5000; // 5 seconds
const TOTAL_SLIDES = 3;

export const FinalReveal: React.FC<FinalRevealProps> = ({ session, imageUrl, selectedSubmission, readOnly = false, onBack }) => {
    const navigate = useNavigate();

    // Safely access app context with fallbacks for Admin/Read-Only modes
    const appCtx = React.useContext(AppContext);
    const phaseConfig = appCtx?.phaseConfig || {};
    const totalTokens = appCtx?.totalTokens || { payload: 0, ai: 0, total: session.total_tokens || 0 };

    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);

    const handleDownloadReport = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await fetch(getApiUrl(`/api/session/${session.team_id}/report`));
            if (!response.ok) throw new Error('Report generation failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PitchSync_Report_${session.team_id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading report:', error);
            alert('Failed to download report. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const goToSlide = useCallback((index: number) => {
        setCurrentSlide(index);
        setDragOffset(0);
    }, []);

    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
        setDragOffset(0);
    }, []);

    const prevSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
        setDragOffset(0);
    }, []);

    // Auto-advance slides every 5 seconds
    useEffect(() => {
        if (isPaused || dragStart !== null) return;
        const timer = setInterval(nextSlide, SLIDE_INTERVAL);
        return () => clearInterval(timer);
    }, [isPaused, nextSlide, dragStart]);

    // Drag handlers
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setDragStart(clientX);
        setIsPaused(true);
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (dragStart === null) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const offset = clientX - dragStart;
        setDragOffset(offset);
    };

    const handleDragEnd = () => {
        if (dragStart === null) return;

        const threshold = 100; // px to trigger slide change
        if (dragOffset < -threshold) {
            nextSlide();
        } else if (dragOffset > threshold) {
            prevSlide();
        }

        setDragStart(null);
        setDragOffset(0);
        setIsPaused(false);
    };

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
        <div className={`final-reveal page-transition ${!readOnly ? 'final-reveal--player' : ''}`}>
            <div className="final-reveal__container">

                {/* Header */}
                <header className="final-reveal__header animate-slideUp">
                    <div className="final-reveal__header-left">
                        {onBack ? (
                            <button className="final-reveal__back-btn btn-secondary" onClick={onBack}>
                                <Icons.ChevronLeft /> {readOnly ? 'BACK TO SUBMISSIONS' : 'BACK TO CURATION'}
                            </button>
                        ) : !readOnly ? (
                            <button className="final-reveal__back-btn btn-secondary" onClick={() => navigate('/curate')}>
                                <Icons.ChevronLeft /> BACK TO CURATION
                            </button>
                        ) : null}
                    </div>
                    <div className="final-reveal__title-group">
                        {readOnly ? (
                            <>
                                <span className="final-reveal__subtitle">TEAM INSPECTION</span>
                                <h1 className="final-reveal__title">{session?.team_id || 'UNKNOWN UNIT'}</h1>
                            </>
                        ) : (
                            <>
                                <span className="final-reveal__subtitle">Mission Complete</span>
                                <h1 className="final-reveal__title">{tier.name}</h1>
                            </>
                        )}
                    </div>
                    <div className="final-reveal__header-right" />
                </header>

                <main className="final-reveal__layout">

                    {/* Image Section */}
                    <section className="final-reveal__visual-deck animate-fadeIn stagger-1">
                        <div className="final-reveal__image-frame reactive-border">
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
                            {!readOnly && (
                                <button
                                    className="final-reveal__present-btn btn-primary animate-flicker"
                                    onClick={() => navigate('/present')}
                                    disabled={!imageUrl}
                                >
                                    <Icons.Mic /> PRESENT PITCH
                                </button>
                            )}
                            <button
                                className={`final-reveal__present-btn btn-secondary ${isDownloading ? 'is-loading' : ''} ${readOnly ? 'admin-download-btn' : ''}`}
                                onClick={handleDownloadReport}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <div className="btn-spinner" />
                                ) : (
                                    <>
                                        <Icons.Download /> DOWNLOAD REPORT
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* Intelligence Panel */}
                    <aside className="final-reveal__intelligence animate-fadeIn stagger-2">

                        {/* Score Card */}
                        <div className="final-reveal__grade-card reactive-border reactive-border--intense">
                            <div className="final-reveal__score-big">
                                <span className="final-reveal__score-val">{Math.round(session.total_score)}</span>
                                <span className="final-reveal__score-label">Performance Score</span>
                            </div>
                            <div className={`final-reveal__tier-seal ${tier.class}`}>
                                {tier.label}
                            </div>
                        </div>

                        {/* Carousel Container */}
                        <div
                            className={`final-reveal__carousel ${dragStart !== null ? 'is-dragging' : ''}`}
                            onMouseEnter={() => setIsPaused(true)}
                            onMouseLeave={() => {
                                handleDragEnd();
                                if (!dragStart) setIsPaused(false);
                            }}
                            onMouseDown={handleDragStart}
                            onMouseMove={handleDragMove}
                            onMouseUp={handleDragEnd}
                            onTouchStart={handleDragStart}
                            onTouchMove={handleDragMove}
                            onTouchEnd={handleDragEnd}
                        >
                            {/* Navigation Arrows */}
                            <button
                                className="final-reveal__arrow final-reveal__arrow--left"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    prevSlide();
                                }}
                                aria-label="Previous slide"
                            >
                                <Icons.ChevronLeft />
                            </button>
                            <button
                                className="final-reveal__arrow final-reveal__arrow--right"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextSlide();
                                }}
                                aria-label="Next slide"
                            >
                                <Icons.ChevronRight />
                            </button>
                            <div
                                className="final-reveal__slides"
                                style={{
                                    transform: `translateX(calc(-${currentSlide * 100}% + ${dragOffset}px))`,
                                    transition: dragStart !== null ? 'none' : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            >
                                {/* Slide 1: Phase Performance */}
                                <div className="final-reveal__slide">
                                    <div className="final-reveal__panel final-reveal__panel--full reactive-border">
                                        <div className="final-reveal__slide-header">
                                            <h3 className="final-reveal__panel-title">Phase Performance</h3>
                                            <span className="final-reveal__slide-tag">Mission Progress</span>
                                        </div>

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
                                            <h4 className="final-reveal__sub-title">Mission Context</h4>
                                            <div className="final-reveal__brief-grid">
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
                                </div>

                                {/* Slide 2: Visual Intelligence */}
                                <div className="final-reveal__slide">
                                    <div className="final-reveal__panel final-reveal__panel--full final-reveal__panel--vision reactive-border reactive-border--accent">
                                        <div className="final-reveal__slide-header">
                                            <h3 className="final-reveal__panel-title" style={{ color: 'var(--accent)' }}>Visual Intelligence</h3>
                                            <span className="final-reveal__slide-tag" style={{ background: 'rgba(var(--accent-rgb), 0.2)', color: 'var(--accent)' }}>AI Analysis</span>
                                        </div>

                                        <div className="final-reveal__metrics-grid">
                                            <div className="final-reveal__metric-card">
                                                <span className="final-reveal__metric-label">ALIGNMENT</span>
                                                <span className="final-reveal__metric-value" style={{
                                                    color: (selectedSubmission?.visual_alignment || session.final_output.visual_alignment) === 'High' ? 'var(--success)' :
                                                        (selectedSubmission?.visual_alignment || session.final_output.visual_alignment) === 'Critical Mismatch' ? 'var(--danger)' : 'var(--warning)'
                                                }}>
                                                    {selectedSubmission?.visual_alignment || session.final_output.visual_alignment || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="final-reveal__metric-card">
                                                <span className="final-reveal__metric-label">MATCH SCORE</span>
                                                <span className="final-reveal__metric-value">
                                                    {selectedSubmission
                                                        ? Math.round((selectedSubmission.visual_score || 0) * 100)
                                                        : (typeof session.final_output.visual_score === 'number'
                                                            ? Math.round(session.final_output.visual_score * 100)
                                                            : '0')}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="final-reveal__ai-report">
                                            <h4 className="final-reveal__sub-title">Analysis Highlights</h4>
                                            <div className="final-reveal__feedback-container">
                                                {(selectedSubmission?.visual_feedback || session.final_output.visual_feedback) ? (
                                                    (selectedSubmission?.visual_feedback || session.final_output.visual_feedback || '').split(/[.!?]\s+/).filter(p => p.trim()).map((point, idx) => (
                                                        <div key={idx} className="final-reveal__feedback-point">
                                                            <div className="final-reveal__point-bullet" />
                                                            <p>{point.trim()}{point.trim().match(/[.!?]$/) ? '' : '.'}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="final-reveal__feedback-placeholder">No visual feedback available</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Slide 3: Efficiency Metrics */}
                                <div className="final-reveal__slide">
                                    <div className="final-reveal__panel final-reveal__panel--full reactive-border">
                                        <div className="final-reveal__slide-header">
                                            <h3 className="final-reveal__panel-title">Efficiency Metrics</h3>
                                            <span className="final-reveal__slide-tag">Operational Data</span>
                                        </div>

                                        <div className="final-reveal__efficiency-layout">
                                            <div className="final-reveal__metrics-section">
                                                <h4 className="final-reveal__metrics-sub">Resource Utilization</h4>
                                                <div className="final-reveal__stat-grid">
                                                    <div className="final-reveal__mini-stat">
                                                        <label>TEAM ID</label>
                                                        <span>{session.team_id}</span>
                                                    </div>
                                                    <div className="final-reveal__mini-stat">
                                                        <label>AI USAGE</label>
                                                        <span style={{ color: 'var(--primary)' }}>{totalTokens.total.toLocaleString()} <small>Tokens</small></span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="final-reveal__metrics-section">
                                                <h4 className="final-reveal__metrics-sub">Performance Deductions</h4>
                                                <div className="final-reveal__penalty-list">
                                                    <div className="final-reveal__penalty-item">
                                                        <span className="final-reveal__penalty-label">TIME</span>
                                                        <span className="final-reveal__penalty-value" style={{ color: timePenalty > 0 ? 'var(--warning)' : 'var(--text-dim)' }}>
                                                            {timePenalty > 0 ? `-${timePenalty}` : '0'} <small>PTS</small>
                                                        </span>
                                                    </div>
                                                    <div className="final-reveal__penalty-item">
                                                        <span className="final-reveal__penalty-label">HINTS</span>
                                                        <span className="final-reveal__penalty-value" style={{ color: hintPenalty > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                                                            {hintPenalty > 0 ? `-${hintPenalty}` : '0'} <small>PTS</small>
                                                        </span>
                                                    </div>
                                                    <div className="final-reveal__penalty-item">
                                                        <span className="final-reveal__penalty-label">RETRIES</span>
                                                        <span className="final-reveal__penalty-value" style={{ color: retryPenalty > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                                                            {retryCount}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Dots */}
                            <div className="final-reveal__carousel-nav">
                                {[0, 1, 2].map((index) => (
                                    <button
                                        key={index}
                                        className={`final-reveal__carousel-dot ${currentSlide === index ? 'final-reveal__carousel-dot--active' : ''}`}
                                        onClick={() => goToSlide(index)}
                                        aria-label={`Go to slide ${index + 1}`}
                                    />
                                ))}
                            </div>

                            {/* Progress Bar */}
                            <div className="final-reveal__carousel-progress">
                                <div
                                    className={`final-reveal__carousel-progress-bar ${isPaused ? 'paused' : ''}`}
                                    key={currentSlide}
                                />
                            </div>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
};
