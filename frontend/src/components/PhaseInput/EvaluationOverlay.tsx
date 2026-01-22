import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../../utils';

interface EvaluationOverlayProps {
    /** Session ID for streaming (optional - if not provided, uses simulated progress) */
    sessionId?: string;
    /** Phase name for streaming */
    phaseName?: string;
    onTimeout?: () => void;
    timeoutMs?: number;
    /** Real-time progress from SSE stream */
    streamProgress?: StreamProgress | null;
}

export interface StreamProgress {
    stage_id: string;
    stage_label: string;
    stage_index: number;
    stage_progress: number;
    overall_progress: number;
    message: string;
    total_stages: number;
}

// Fallback phases when not using streaming
const FALLBACK_PHASES = [
    { id: 'init', label: 'Initializing AI Agents' },
    { id: 'red_team', label: 'Red Team Analysis' },
    { id: 'lead_partner', label: 'Lead Partner Review' },
    { id: 'visual', label: 'Visual Intelligence' },
    { id: 'scoring', label: 'Calculating Score' },
];

export const EvaluationOverlay: React.FC<EvaluationOverlayProps> = ({
    onTimeout,
    timeoutMs = 120000,  // Increased to match backend timeout
    streamProgress
}) => {
    const [elapsed, setElapsed] = useState(0);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [simulatedPhase, setSimulatedPhase] = useState(0);

    // Use real progress if available, otherwise fallback to simulation
    const isStreaming = streamProgress !== null && streamProgress !== undefined;

    const currentStageIndex = isStreaming
        ? streamProgress.stage_index
        : simulatedPhase;

    const currentStageLabel = isStreaming
        ? streamProgress.stage_label
        : FALLBACK_PHASES[simulatedPhase]?.label || 'Processing...';

    const overallProgress = isStreaming
        ? streamProgress.overall_progress
        : (simulatedPhase / FALLBACK_PHASES.length) * 100;

    const statusMessage = isStreaming
        ? streamProgress.message
        : '';

    // Fallback: Simulate phase progression when not streaming
    useEffect(() => {
        if (isStreaming || isTimedOut) return;

        const timer = setTimeout(() => {
            if (simulatedPhase < FALLBACK_PHASES.length - 1) {
                setSimulatedPhase(prev => prev + 1);
            } else {
                // Loop for long operations
                setSimulatedPhase(0);
            }
        }, 4000 + Math.random() * 2000);  // 4-6s per phase

        return () => clearTimeout(timer);
    }, [simulatedPhase, isStreaming, isTimedOut]);

    // Track elapsed time
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(prev => {
                const next = prev + 1;
                if (next * 1000 >= timeoutMs && !isTimedOut) {
                    setIsTimedOut(true);
                    onTimeout?.();
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timeoutMs, isTimedOut, onTimeout]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    };

    return (
        <div className="pi-eval-overlay">
            <div className="pi-eval-backdrop" />

            <div className="pi-eval-content reactive-border reactive-border--intense">
                {/* Animated Core */}
                <div className="pi-eval-orb">
                    <div className="pi-eval-ring pi-eval-ring--1" />
                    <div className="pi-eval-ring pi-eval-ring--2" />
                    <div className="pi-eval-ring pi-eval-ring--3" />
                    <div className={`pi-eval-core ${isTimedOut ? 'pi-eval-core--warning' : ''}`}>
                        {isTimedOut ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                                <rect x="9" y="9" width="6" height="6" />
                                <line x1="9" y1="1" x2="9" y2="4" />
                                <line x1="15" y1="1" x2="15" y2="4" />
                                <line x1="9" y1="20" x2="9" y2="23" />
                                <line x1="15" y1="20" x2="15" y2="23" />
                                <line x1="20" y1="9" x2="23" y2="9" />
                                <line x1="20" y1="15" x2="23" y2="15" />
                                <line x1="1" y1="9" x2="4" y2="9" />
                                <line x1="1" y1="15" x2="4" y2="15" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Title */}
                <h2 className={`pi-eval-title ${isTimedOut ? 'pi-eval-title--warning' : ''}`}>
                    {isTimedOut ? 'Extended Processing' : 'Evaluating Intel'}
                </h2>

                {/* Phase Progress Dots */}
                <div className="pi-eval-phases">
                    {FALLBACK_PHASES.map((phase, idx) => (
                        <div
                            key={phase.id}
                            className={`pi-eval-phase ${idx === currentStageIndex ? 'pi-eval-phase--active' : ''} ${idx < currentStageIndex ? 'pi-eval-phase--done' : ''}`}
                        >
                            <div className="pi-eval-phase-dot" />
                            {idx === currentStageIndex && (
                                <span className="pi-eval-phase-label">{currentStageLabel}</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Status Message (from stream) */}
                {statusMessage && (
                    <p className="pi-eval-status">{statusMessage}</p>
                )}

                {/* Progress Bar */}
                <div className="pi-eval-progress">
                    <div
                        className={`pi-eval-bar ${isTimedOut ? 'pi-eval-bar--warning' : ''}`}
                        style={isStreaming ? {
                            width: `${overallProgress}%`,
                            animation: 'none',
                            background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.8), rgba(236, 72, 153, 0.7))'
                        } : undefined}
                    />
                </div>

                {/* Timer */}
                <div className="pi-eval-timer">
                    <span className={`pi-eval-timer-value ${isTimedOut ? 'pi-eval-timer-value--warning' : ''}`}>
                        {formatTime(elapsed)}
                    </span>
                </div>

                {/* Timeout Message */}
                {isTimedOut && (
                    <p className="pi-eval-timeout-msg">
                        The AI is taking longer than expected. Please wait or refresh.
                    </p>
                )}
            </div>
        </div>
    );
};


/**
 * Hook to subscribe to SSE streaming progress from the backend.
 * Returns the current progress state that can be passed to EvaluationOverlay.
 */
export function useEvaluationStream(
    isActive: boolean,
    sessionId: string,
    phaseName: string,
    responses: { q: string; a: string; hint_used?: boolean }[],
    imageData?: string | null,
    onComplete?: (result: any) => void,
    onError?: (error: string) => void
): StreamProgress | null {
    const [progress, setProgress] = useState<StreamProgress | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const onCompleteRef = useRef(onComplete);  // Store callback in ref to avoid stale closure
    onCompleteRef.current = onComplete;

    useEffect(() => {
        if (!isActive || !sessionId || !phaseName) {
            setProgress(null);
            return;
        }

        // Use fetch with POST to start the stream
        const startStream = async () => {
            try {
                abortControllerRef.current = new AbortController();

                const response = await fetch(getApiUrl('/api/submit-phase-stream'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        phase_name: phaseName,
                        responses: responses,
                        image_data: imageData || null
                    }),
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    throw new Error(`Stream failed: ${response.status}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('No response body');
                }

                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE events from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            try {
                                const parsed = JSON.parse(data);
                                setProgress(parsed);
                            } catch (e) {
                                // Invalid JSON, skip
                            }
                        } else if (line.startsWith('event: complete')) {
                            // Next data line contains the final result - will be parsed above
                            // Call onComplete with the last parsed data
                        } else if (line.startsWith('event: error')) {
                            // Error handling done in catch block
                        }
                    }
                }
                // Stream finished, call onComplete
                onCompleteRef.current?.(progress);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Stream error:', error);
                    onError?.(error.message || 'Stream failed');
                }
            }
        };

        startStream();

        return () => {
            abortControllerRef.current?.abort();
            setProgress(null);
        };
    }, [isActive, sessionId, phaseName]);

    return progress;
}
