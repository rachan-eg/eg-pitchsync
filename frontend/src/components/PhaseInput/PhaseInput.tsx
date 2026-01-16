import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../../AppContext';
import { EvaluationOverlay } from './EvaluationOverlay';
import type { PhaseResponse } from '../../types';
import './PhaseInput.css';

interface PhaseInputProps {
    phase: any;
    phaseNumber: number;
    totalPhases: number;
    timeLimit: number;
    isSubmitting: boolean;
    initialResponses?: PhaseResponse[];
}

const Icons = {
    Cpu: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" /></svg>,
    Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    Target: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
    ChevronLeft: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
    ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
    Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
    Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
    Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    Lightbulb: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" /></svg>,
    Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
    Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
};

export const PhaseInput: React.FC<PhaseInputProps> = ({
    phase,
    phaseNumber,
    totalPhases,
    timeLimit,
    isSubmitting,
    initialResponses = []
}) => {
    const { submitPhase, elapsedSeconds, scoringInfo, session, phaseConfig, setCurrentPhaseResponses } = useApp();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);
    const [originalAnswers, setOriginalAnswers] = useState<string[]>([]);
    const [hintsUsed, setHintsUsed] = useState<boolean[]>([]);
    const [originalHintsUsed, setOriginalHintsUsed] = useState<boolean[]>([]);
    const [isEditing, setIsEditing] = useState(true);
    const [hintModalOpen, setHintModalOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastPhaseIdRef = useRef<string | null>(null);

    // Initialize or sync answers and hints
    useEffect(() => {
        const initialAnsw = phase.questions.map((q: any) => {
            const id = typeof q === 'string' ? q : q.id;
            const prev = initialResponses.find(r => r.question_id === id);
            return prev?.a || '';
        });
        const initialHints = phase.questions.map((q: any) => {
            const id = typeof q === 'string' ? q : q.id;
            const prev = initialResponses.find(r => r.question_id === id);
            return prev?.hint_used || false;
        });
        setAnswers(initialAnsw);
        setHintsUsed(initialHints);

        // Only reset originals and question index if phase changes
        const currentId = phase.id || phase.name;
        if (currentId !== lastPhaseIdRef.current) {
            setOriginalAnswers([...initialAnsw]);
            setOriginalHintsUsed([...initialHints]);
            setCurrentQuestionIndex(0);
            lastPhaseIdRef.current = currentId;
        }
    }, [phase, initialResponses]);

    const handleChange = (val: string) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = val;
        setAnswers(newAnswers);

        // SYNC TO CONTEXT FOR PERSISTENCE
        const currentResponses = phase.questions.map((q: any, i: number) => {
            const questionText = typeof q === 'string' ? q : q.text || q.question;
            const question_id = typeof q === 'string' ? q : q.id;
            return {
                q: questionText,
                a: newAnswers[i] || '',
                question_id,
                hint_used: hintsUsed[i] || false
            };
        });
        setCurrentPhaseResponses(currentResponses);
    };

    const handleNext = useCallback(() => {
        if (currentQuestionIndex < phase.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setIsEditing(true);
        }
    }, [currentQuestionIndex, phase.questions.length]);

    const handlePrev = useCallback(() => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
            setIsEditing(true);
        }
    }, [currentQuestionIndex]);

    const allAnswered = answers.every(a => a.trim().length >= 100);
    const anyChanges =
        answers.some((a, i) => originalAnswers[i] !== undefined && a !== originalAnswers[i]) ||
        hintsUsed.some((h, i) => originalHintsUsed[i] !== undefined && h !== originalHintsUsed[i]);

    const handleSubmit = async () => {
        const responses = phase.questions.map((q: any, i: number) => {
            const questionText = typeof q === 'string' ? q : q.text || q.question;
            const question_id = typeof q === 'string' ? q : q.id;
            return {
                q: questionText,
                a: answers[i],
                question_id,
                hint_used: hintsUsed[i]
            };
        });
        await submitPhase(responses);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
            if (currentQuestionIndex < phase.questions.length - 1) {
                handleNext();
            } else if (allAnswered) {
                handleSubmit();
            }
        }
    };

    const unlockHint = () => {
        const newHints = [...hintsUsed];
        newHints[currentQuestionIndex] = true;
        setHintsUsed(newHints);
        setHintModalOpen(false);

        // SYNC TO CONTEXT
        const currentResponses = phase.questions.map((q: any, i: number) => {
            const questionText = typeof q === 'string' ? q : q.text || q.question;
            const question_id = typeof q === 'string' ? q : q.id;
            return {
                q: questionText,
                a: answers[i] || '',
                question_id,
                hint_used: newHints[i] || false
            };
        });
        setCurrentPhaseResponses(currentResponses);
    };

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentQuestion = phase.questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestionIndex] || '';
    const isHintUsed = hintsUsed[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === phase.questions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;
    const currentValid = currentAnswer.trim().length >= 100;
    const currentHintPenalty = typeof currentQuestion !== 'string' ? (currentQuestion.hint_penalty || 50) : 50;

    return (
        <div className="pi-container animate-fade-in">
            {/* Operational Area */}
            <div className="pi-main">

                {/* Header */}
                <header className="pi-header">
                    <div className="pi-header__title-group">
                        <div className="pi-header__meta">
                            <span className="pi-header__tag">Operation Phase {phaseNumber} / {totalPhases}</span>
                            <span className="pi-header__separator">//</span>
                            <span className="pi-header__weight">WEIGHT: {Math.round(phase.weight * 100)}%</span>
                            <span className="pi-header__separator">//</span>
                            <span className="pi-header__max">MAX POTENTIAL: {Math.round((scoringInfo?.max_ai_points || 400) * phase.weight)} PTS</span>
                        </div>
                        <h2 className="pi-header__name">{phase.name}</h2>
                    </div>

                    <div className="pi-controls">
                        {phase.questions.map((_: any, i: number) => {
                            const isDone = answers[i]?.trim().length >= 100;
                            const hasChanged = originalAnswers[i] !== undefined && answers[i] !== originalAnswers[i];

                            return (
                                <button
                                    key={i}
                                    className={`pi-btn ${i === currentQuestionIndex ? 'pi-btn--primary' : 'pi-btn--secondary'} ${isDone ? 'pi-btn--done' : ''} ${hasChanged ? 'pi-btn--changed' : ''}`}
                                    style={{ padding: '0.35rem 0.75rem', minWidth: '40px', position: 'relative' }}
                                    onClick={() => setCurrentQuestionIndex(i)}
                                    title={hasChanged ? `Question ${i + 1} (Modified)` : `Question ${i + 1}`}
                                >
                                    {i + 1}
                                    {hasChanged && <span className="pi-btn-dot" />}
                                </button>
                            );
                        })}
                    </div>
                </header>

                {/* Body */}
                <main className="pi-body">
                    <div className="pi-question-box">
                        <div className="pi-question">
                            <span className="pi-question-num">{currentQuestionIndex + 1}</span>
                            <div className="pi-question-flex">
                                <span className="pi-question-text">
                                    {typeof currentQuestion === 'string' ? currentQuestion : currentQuestion.text || currentQuestion.question}
                                </span>
                                {!isHintUsed && typeof currentQuestion !== 'string' && currentQuestion.hint_text && (
                                    <button
                                        className="pi-hint-trigger"
                                        onClick={() => setHintModalOpen(true)}
                                        title="Access Intelligence Hint"
                                    >
                                        <Icons.Lightbulb />
                                    </button>
                                )}
                            </div>
                        </div>
                        {isHintUsed && typeof currentQuestion !== 'string' && (
                            <div className="pi-hint-box animate-slide-down">
                                <div className="pi-hint-label">INTEL DECRYPTED:</div>
                                <div className="pi-hint-text">{currentQuestion.hint_text}</div>
                            </div>
                        )}
                    </div>

                    <div className="pi-input-area">
                        {isEditing ? (
                            <textarea
                                ref={textareaRef}
                                className="pi-textarea custom-scrollbar"
                                value={currentAnswer}
                                onChange={(e) => handleChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={() => currentAnswer.trim().length > 0 && setIsEditing(false)}
                                placeholder="Type your response here (min 100 chars). Press Ctrl+Enter for next."
                                autoFocus
                            />
                        ) : (
                            <div
                                className="pi-textarea pi-textarea--preview custom-scrollbar"
                                onClick={() => setIsEditing(true)}
                                title="Click to edit"
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {currentAnswer || "_Empty response. Click to edit._"}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </main>

                {/* Footer */}
                <footer className="pi-footer">
                    <div className="pi-footer__left">
                        <div className="pi-char-count">
                            <span className="pi-char-label">Total Chars</span>
                            <div className="pi-char-row">
                                <span className={`pi-char-value ${currentValid ? 'pi-char-value--ok' : ''}`}>
                                    {currentAnswer.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pi-footer__center">
                        <div className="pi-controls">
                            <button
                                className="pi-btn pi-btn--secondary"
                                onClick={handlePrev}
                                disabled={isFirstQuestion}
                                title="Previous Intel Question"
                            >
                                <Icons.ChevronLeft /> Back
                            </button>

                            {!isLastQuestion && (
                                <button
                                    className="pi-btn pi-btn--secondary"
                                    onClick={handleNext}
                                    title="Next Intel Question"
                                >
                                    Next <Icons.ChevronRight />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="pi-footer__right">
                        {(() => {
                            const pName = phaseConfig[phaseNumber]?.name;
                            const existing = session?.phases[pName];
                            const isPassed = existing?.status === 'passed';
                            const showReview = isPassed && !anyChanges;

                            return (
                                <button
                                    className={`pi-btn ${allAnswered ? (showReview ? 'pi-btn--primary pi-btn--done' : 'pi-btn--primary') : 'pi-btn--secondary'}`}
                                    style={{ position: 'relative' }}
                                    onClick={handleSubmit}
                                    disabled={!allAnswered || isSubmitting}
                                    title={!allAnswered ? 'Complete all questions to finalize' : (anyChanges ? 'Changes detected: Submit for re-evaluation' : (isPassed ? 'No changes: Review previous evaluation' : 'Submit for AI Evaluation'))}
                                >
                                    {isSubmitting ? 'Processing...' : (showReview ? 'Review Evaluation' : 'Finalize Phase')}
                                    {showReview ? <Icons.Check /> : <Icons.Send />}
                                    {anyChanges && <span className="pi-btn-dot" />}
                                </button>
                            );
                        })()}
                    </div>
                </footer>
            </div>

            {/* Intelligence Sidebar */}
            <aside className="pi-sidebar">
                {/* MISSION CLOCK (Simplified) */}
                <div className="pi-simple-clock">
                    <Icons.Clock />
                    <div className="pi-simple-timer-group">
                        <span className={`pi-simple-timer ${elapsedSeconds > timeLimit ? 'text-danger' : 'text-secondary'}`}>
                            {formatTime(elapsedSeconds)}
                        </span>
                        {/* <span className="pi-simple-limit">/ {formatTime(timeLimit)}</span> */}
                    </div>
                </div>

                {/* MISSION OBJECTIVES */}
                <div className="pi-sidebar-section">
                    <div className="pi-sidebar-header">
                        <div className="pi-sidebar-icon"><Icons.Target /></div>
                        <h3 className="pi-sidebar-title">Strategic Metrics</h3>
                    </div>
                    <div className="pi-sidebar-content">
                        <ul className="pi-list">
                            <li className="pi-list-item pi-list-item--active">
                                <span className="pi-intel-content">
                                    {typeof currentQuestion === 'string' ? 'Strategic Clarity' : (currentQuestion.criteria || 'Analytical Depth')}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* EVALUATION FOCUS */}
                <div className="pi-sidebar-section">
                    <div className="pi-sidebar-header">
                        <div className="pi-sidebar-icon"><Icons.Cpu /></div>
                        <h3 className="pi-sidebar-title">Evaluation Focus</h3>
                    </div>
                    <div className="pi-sidebar-content">
                        <div className="pi-scoring-item">
                            <span>
                                Time Penalty
                                <span className="pi-scoring-rule">(-10/10m)</span>
                            </span>
                            {(() => {
                                const pName = phaseConfig[phaseNumber]?.name;
                                const existing = session?.phases[pName];
                                const useRecorded = existing?.status === 'passed' && !anyChanges;
                                const timeVal = useRecorded ? (existing.metrics.duration_seconds) : elapsedSeconds;

                                return (
                                    <span className="pi-scoring-val" style={{ color: timeVal > timeLimit ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        {timeVal > timeLimit ? '-' : ''}
                                        {timeVal > timeLimit
                                            ? Math.min((scoringInfo?.time_penalty_max || 90), Math.ceil((timeVal - timeLimit) / 600) * 10)
                                            : 0
                                        } PTS
                                    </span>
                                );
                            })()}
                        </div>

                        <div className="pi-scoring-item">
                            <span>Hint Penalty</span>
                            {(() => {
                                const totalPenalty = hintsUsed.reduce((acc, used, idx) => {
                                    if (!used) return acc;
                                    const q = phase.questions[idx];
                                    const val = typeof q !== 'string' ? (q.hint_penalty || 50) : 50;
                                    return acc + val;
                                }, 0);
                                return (
                                    <span className="pi-scoring-val" style={{ color: totalPenalty > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        {totalPenalty > 0 ? `-${totalPenalty}` : '0'} PTS
                                    </span>
                                );
                            })()}
                        </div>

                        <div className="pi-scoring-item">
                            <span>Retries</span>
                            {(() => {
                                const pName = phaseConfig[phaseNumber]?.name;
                                const existing = session?.phases[pName];

                                // Use backend's authoritative metrics.retries value directly.
                                // This ensures the display matches what the backend will enforce.
                                // Backend: Initial=0, R1=1, R2=2, R3=3. Blocked at R4 (4 > 3).
                                const displayRetries = existing?.metrics?.retries || 0;

                                return (
                                    <span className="pi-scoring-val" style={{ color: displayRetries > (scoringInfo?.max_retries || 3) ? 'var(--danger)' : (displayRetries > 0 ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                                        {displayRetries} <span style={{ fontSize: '0.8em', opacity: 0.7 }}>/ {scoringInfo?.max_retries || 3}</span>
                                    </span>
                                );
                            })()}
                        </div>

                        {/* RETRIES LOG */}
                        {(() => {
                            const pName = phaseConfig[phaseNumber]?.name;
                            const existing = session?.phases[pName];
                            const history = existing?.history || [];
                            const currentMetrics = existing?.metrics;

                            // 1. Start with history
                            const allAttempts: Array<{ weighted_score: number; isCurrent?: boolean; label?: string; isDraft?: boolean }> = [
                                ...history.map((h, i) => ({
                                    weighted_score: h.weighted_score,
                                    label: i === 0 ? "INITIAL ATTEMPT" : `RETRY ${i}`,
                                    isCurrent: false
                                })),
                            ];

                            const hasEvaluatedCurrent = currentMetrics && (currentMetrics.ai_score > 0 || existing?.status === 'passed' || existing?.status === 'failed');

                            // 2. Add current finalized entry or draft
                            if (hasEvaluatedCurrent) {
                                const currentLabel = allAttempts.length === 0 ? "INITIAL ATTEMPT" : `RETRY ${allAttempts.length}`;

                                // Can we add a new draft? (Only if we haven't hit the limit)
                                const canAddDraft = anyChanges && (allAttempts.length < (scoringInfo?.max_retries || 3));

                                if (canAddDraft) {
                                    // Previous eval becomes history, new draft is current
                                    allAttempts.push({
                                        weighted_score: currentMetrics.weighted_score,
                                        label: currentLabel,
                                        isCurrent: false
                                    });
                                    allAttempts.push({
                                        weighted_score: 0,
                                        label: `RETRY ${allAttempts.length}`,
                                        isCurrent: true,
                                        isDraft: true
                                    });
                                } else {
                                    // Highlight the finalized result as current if:
                                    // - No changes detected
                                    // - OR we've hit the retry limit (can't draft anymore)
                                    allAttempts.push({
                                        weighted_score: currentMetrics.weighted_score,
                                        label: currentLabel,
                                        isCurrent: true
                                    });
                                }
                            } else if (allAttempts.length < (scoringInfo?.max_retries || 3) + 1) {
                                // Fresh phase, no submissions yet - show Initial Draft
                                allAttempts.push({
                                    weighted_score: 0,
                                    label: allAttempts.length === 0 ? "INITIAL ATTEMPT" : `RETRY ${allAttempts.length}`,
                                    isCurrent: true,
                                    isDraft: true
                                });
                            }

                            if (allAttempts.length > 0) {
                                return (
                                    <div className="pi-attempts-log">
                                        <div className="pi-scoring-separator" style={{ margin: '0.75rem 0 0.5rem', borderTop: '1px dashed var(--border-light)', opacity: 0.3 }} />
                                        <div className="pi-attempts-label">RETRY HISTORY</div>
                                        <div className="pi-attempts-list custom-scrollbar">
                                            {allAttempts.map((h, idx) => (
                                                <div key={idx} className={`pi-attempt-item ${h.isCurrent ? 'pi-attempt-item--current' : ''} ${h.isDraft ? 'pi-attempt-item--draft' : ''}`}>
                                                    <div className="pi-attempt-info">
                                                        <span className="pi-attempt-num">{h.label}</span>
                                                        {h.isCurrent && <span className="pi-attempt-tag">{h.isDraft ? 'DRAFT' : 'CURRENT'}</span>}
                                                    </div>
                                                    <span className="pi-attempt-score">
                                                        {h.isDraft ? '--' : `${Math.round(h.weighted_score)} PTS`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            </aside>

            {/* Hint Modal */}
            {hintModalOpen && (
                <div className="pi-modal-overlay animate-fade-in">
                    <div className="pi-modal animate-slide-up">
                        <div className="pi-modal-icon">
                            <Icons.Alert />
                        </div>
                        <h3 className="pi-modal-title">Unlock Strategic Insight?</h3>
                        <p className="pi-modal-desc">
                            Accessing this intelligence hint will deduct <span className="pi-modal-highlight">{currentHintPenalty} points</span> from your potential score for this phase.
                            This action is recorded and cannot be undone.
                        </p>
                        <div className="pi-modal-actions">
                            <button className="pi-btn pi-btn--secondary" onClick={() => setHintModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="pi-btn pi-btn--primary" onClick={unlockHint}>
                                Unlock Intel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSubmitting && <EvaluationOverlay />}
        </div>
    );
};
