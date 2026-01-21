import React from 'react';
import type { SubmitPhaseResponse } from '../../types';
import './PhaseFeedback.css';

interface PhaseFeedbackProps {
    result: SubmitPhaseResponse;
    onContinue: () => void;
    onRetry: () => void;
    onClose?: () => void;
}

const Icons = {
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    X: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    ),
    Up: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
    ),
    Down: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    )
};

export const PhaseFeedback: React.FC<PhaseFeedbackProps> = ({
    result,
    onContinue,
    onRetry,
    onClose
}) => {
    const isSuccess = result.passed;

    return (
        <div className="phase-feedback animate-fadeIn">
            <div className="phase-feedback__modal animate-slideUp">

                {/* Header */}
                <div className={`phase-feedback__header ${isSuccess ? 'phase-feedback__header--success' : 'phase-feedback__header--failure'}`}>
                    <div className="phase-feedback__header-left">
                        <div className={`phase-feedback__status-icon ${isSuccess ? 'phase-feedback__status-icon--success' : 'phase-feedback__status-icon--failure'}`}>
                            {isSuccess ? <Icons.Check /> : <Icons.X />}
                        </div>
                        <div className="phase-feedback__status-text">
                            <h2 className="phase-feedback__status-title">
                                {isSuccess ? 'PHASE CLEARED' : 'PHASE FAILED'}
                            </h2>
                            <p className="phase-feedback__status-subtitle">AI EVALUATION PROTOCOL</p>
                        </div>
                    </div>

                    <div className="phase-feedback__header-right">
                        {/* Metrics Bar */}
                        <div className="phase-feedback__metrics">
                            <div className="phase-feedback__metric">
                                <div className="phase-feedback__metric-label">AI SCORE</div>
                                <div className="phase-feedback__metric-value">{result.metrics.ai_quality_points.toFixed(0)}</div>
                            </div>
                            <div className="phase-feedback__metric-divider" />
                            <div className="phase-feedback__metric">
                                <div className="phase-feedback__metric-label">WEIGHT</div>
                                <div className="phase-feedback__metric-value phase-feedback__metric-value--muted">{(result.metrics.phase_weight * 100).toFixed(0)}%</div>
                            </div>
                            {result.metrics.total_ai_tokens !== undefined && (
                                <>
                                    <div className="phase-feedback__metric-divider" />
                                    <div className="phase-feedback__metric">
                                        <div className="phase-feedback__metric-label">AI TOKENS</div>
                                        <div className="phase-feedback__metric-value">{result.metrics.total_ai_tokens}</div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="phase-feedback__score">
                            <div className="phase-feedback__score-label">SCORE</div>
                            <div className={`phase-feedback__score-value ${isSuccess ? 'phase-feedback__score-value--success' : 'phase-feedback__score-value--failure'}`}>
                                {result.phase_score.toFixed(0)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scoring Audit Trail */}
                <div className="phase-feedback__audit animate-fadeIn">
                    <div className="phase-feedback__audit-track">
                        <div className="phase-feedback__audit-item">
                            <div className="phase-feedback__audit-label">BASE AI QUALITY</div>
                            <div className="phase-feedback__audit-value">{result.metrics.ai_quality_points.toFixed(0)}</div>
                        </div>

                        {result.metrics.hint_penalty > 0 && (
                            <div className="phase-feedback__audit-item phase-feedback__audit-item--penalty">
                                <div className="phase-feedback__audit-label">HINT PENALTY</div>
                                <div className="phase-feedback__audit-value">-{result.metrics.hint_penalty.toFixed(0)}</div>
                            </div>
                        )}

                        {result.metrics.time_penalty > 0 && (
                            <div className="phase-feedback__audit-item phase-feedback__audit-item--penalty">
                                <div className="phase-feedback__audit-label">TIME OVERAGE</div>
                                <div className="phase-feedback__audit-value">-{result.metrics.time_penalty.toFixed(0)}</div>
                            </div>
                        )}

                        {result.metrics.retry_penalty > 0 && (
                            <div className="phase-feedback__audit-item phase-feedback__audit-item--penalty">
                                <div className="phase-feedback__audit-label">RETRY TAX</div>
                                <div className="phase-feedback__audit-value">-{result.metrics.retry_penalty.toFixed(0)}</div>
                            </div>
                        )}

                        {result.metrics.efficiency_bonus > 0 && (
                            <div className="phase-feedback__audit-item phase-feedback__audit-item--bonus">
                                <div className="phase-feedback__audit-label">TOKEN BONUS</div>
                                <div className="phase-feedback__audit-value">+{result.metrics.efficiency_bonus.toFixed(0)}</div>
                            </div>
                        )}

                        <div className="phase-feedback__audit-separator" />

                        <div className="phase-feedback__audit-item phase-feedback__audit-item--result">
                            <div className="phase-feedback__audit-label">WEIGHTED ({(result.metrics.phase_weight * 100).toFixed(0)}%)</div>
                            <div className="phase-feedback__audit-value">{result.phase_score.toFixed(0)}</div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="phase-feedback__body custom-scrollbar">
                    <div className="phase-feedback__grid">

                        {/* Column 1: Verdict */}
                        <div className="phase-feedback__verdict">
                            <div className="phase-feedback__verdict-card glass-card">
                                <div className="phase-feedback__verdict-label">AI Judge Verdict</div>
                                <div className="phase-feedback__verdict-points">
                                    {result.feedback.split(/[.!?]\s+/).filter(p => p.trim()).map((point, idx) => (
                                        <div key={idx} className="phase-feedback__verdict-item">
                                            <div className="phase-feedback__verdict-bullet" />
                                            <p className="phase-feedback__verdict-text">
                                                {point.trim()}{point.trim().match(/[.!?]$/) ? '' : '.'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {result.rationale && (
                                <div className="phase-feedback__rationale">
                                    <div className="phase-feedback__rationale-tag">NEURAL MONOLOGUE</div>
                                    <p className="phase-feedback__rationale-text">
                                        {result.rationale}
                                    </p>

                                    {result.metrics.input_tokens !== undefined && (
                                        <div className="phase-feedback__usage-tag">
                                            <span className="phase-feedback__usage-label">AI RESOURCE USAGE:</span>
                                            <span className="phase-feedback__usage-value">
                                                IN: {result.metrics.input_tokens} | OUT: {result.metrics.output_tokens}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Column 2: Strengths */}
                        <div className="phase-feedback__list-card phase-feedback__list-card--strengths glass-card">
                            <div className="phase-feedback__list-header phase-feedback__list-header--strengths">
                                <span className="phase-feedback__list-icon phase-feedback__list-icon--strengths"><Icons.Up /></span>
                                <span className="phase-feedback__list-title phase-feedback__list-title--strengths">Asset Strengths</span>
                            </div>
                            <ul className="phase-feedback__list">
                                {result.strengths.length > 0 ? result.strengths.map((s, i) => (
                                    <li key={i} className="phase-feedback__list-item">
                                        <div className="phase-feedback__list-marker phase-feedback__list-marker--strengths" />
                                        <span>{s}</span>
                                    </li>
                                )) : <li className="phase-feedback__list-empty">AI was unable to identify specific strengths in this submission.</li>}
                            </ul>
                        </div>

                        {/* Column 3: Improvements */}
                        <div className="phase-feedback__list-card phase-feedback__list-card--improvements glass-card">
                            <div className="phase-feedback__list-header phase-feedback__list-header--improvements">
                                <span className="phase-feedback__list-icon phase-feedback__list-icon--improvements"><Icons.Down /></span>
                                <span className="phase-feedback__list-title phase-feedback__list-title--improvements">Optimization Required</span>
                            </div>
                            <ul className="phase-feedback__list">
                                {result.improvements.length > 0 ? result.improvements.map((s, i) => (
                                    <li key={i} className="phase-feedback__list-item">
                                        <div className="phase-feedback__list-marker phase-feedback__list-marker--improvements" />
                                        <span>{s}</span>
                                    </li>
                                )) : <li className="phase-feedback__list-empty">Phase parameters optimized. No further improvements required.</li>}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="phase-feedback__actions">
                    <div className={`phase-feedback__status-indicator ${isSuccess ? 'phase-feedback__status-indicator--success' : 'phase-feedback__status-indicator--failure'}`}>
                        <div className={`phase-feedback__status-dot ${isSuccess ? 'phase-feedback__status-dot--success' : 'phase-feedback__status-dot--failure'}`} />
                        {isSuccess ? 'PROTOCOL VERIFIED' : 'SYSTEM ALERT'}
                    </div>

                    <div className="phase-feedback__action-buttons">
                        {/* WARNING MESSAGE (Failure Proceed) */}
                        {!isSuccess && result.can_proceed && (
                            <div className="phase-feedback__proceed-warning">
                                Note: Proceeding without achieving target clearance.
                            </div>
                        )}

                        {/* SECONDARY ACTION: BACK */}
                        {onClose && (isSuccess || result.can_proceed) && (
                            <button onClick={onClose} className="phase-feedback__btn btn-secondary">
                                Back
                            </button>
                        )}

                        {/* SECONDARY ACTION: RETRY (Only if NOT passed and NOT exhausted, OR if ALLOW_FAIL_PROCEED is true but we still want to offer retry) */}
                        {!isSuccess && !result.can_proceed && (
                            <button onClick={onRetry} className="phase-feedback__btn phase-feedback__btn--retry btn-primary">
                                RETRY PHASE
                            </button>
                        )}

                        {/* PRIMARY ACTION: CONTINUE / NEXT */}
                        {(isSuccess || result.can_proceed) && (
                            <button
                                onClick={onContinue}
                                className="phase-feedback__btn phase-feedback__btn--continue btn-primary"
                            >
                                {result.is_final_phase ? 'COMPLETE PHASE' : 'NEXT PHASE →'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
