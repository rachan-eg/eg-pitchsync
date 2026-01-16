/**
 * Session Provider
 * Manages session state, phase data, and API interactions for the pitch game.
 * 
 * This is the core provider that handles:
 * - Session initialization and resumption
 * - Phase progression and scoring
 * - Usecase/theme selection
 * - Final synthesis and image generation
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiUrl, getFullUrl } from '../utils';
import { useTimer } from './TimerProvider';
import { useUI } from './UIProvider';
import type {
    UseCase, Theme, SessionState, PhaseDefinition, ScoringInfo,
    InitResponse, StartPhaseResponse, SubmitPhaseResponse, PhaseResponse
} from '../types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate highest unlocked phase from phase_scores.
 * Server-side is authoritative; frontend derives from what backend tells us.
 */
const calculateHighestUnlockedPhase = (
    phaseScores: Record<string, number>,
    phaseConfig: Record<number, PhaseDefinition>,
    isComplete: boolean
): number => {
    const totalPhases = Object.keys(phaseConfig).length;
    if (isComplete) {
        return totalPhases + 1;
    }
    const completedCount = Object.keys(phaseScores).length;
    return Math.max(1, completedCount + 1);
};

// =============================================================================
// CONTEXT TYPES
// =============================================================================
interface SessionContextType {
    // Selection State
    selectedUsecase: UseCase | null;
    selectedTheme: Theme | null;
    setSelectedUsecase: (usecase: UseCase | null) => void;
    setSelectedTheme: (theme: Theme | null) => void;

    // Session State
    session: SessionState | null;
    phaseConfig: Record<number, PhaseDefinition>;
    scoringInfo: ScoringInfo | null;
    highestUnlockedPhase: number;

    // Phase State
    phaseResult: SubmitPhaseResponse | null;
    setPhaseResult: (result: SubmitPhaseResponse | null) => void;
    currentPhaseResponses: PhaseResponse[];
    setCurrentPhaseResponses: (responses: PhaseResponse[]) => void;

    // Prompt & Image State
    curatedPrompt: string;
    setCuratedPrompt: (prompt: string) => void;
    generatedImageUrl: string;
    uploadedImages: string[];
    activeRevealImage: string;
    setActiveRevealImage: (url: string) => void;

    // Token Usage (display only - calculated by backend)
    totalTokens: { payload: number; ai: number; total: number };

    // Actions
    initSession: (teamId: string) => Promise<{ success: boolean; isResumed: boolean; isComplete: boolean; currentPhase: number }>;
    startPhase: (phaseNum: number) => Promise<void>;
    submitPhase: (responses: PhaseResponse[]) => Promise<void>;
    handleFeedbackAction: (action: 'CONTINUE' | 'RETRY') => Promise<{ navigateTo?: string }>;
    curatePrompt: () => Promise<void>;
    regeneratePrompt: (additionalNotes: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<void>;
    submitPitchImage: (finalPrompt: string, file: File) => Promise<void>;
    resetToStart: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

// =============================================================================
// SESSION PROVIDER
// =============================================================================
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { startTimer, pauseTimer, resumeTimer, stopTimer, elapsedSeconds } = useTimer();
    const { loading, setLoading, setError } = useUI();

    // Selection State
    const [selectedUsecase, setSelectedUsecase] = useState<UseCase | null>(null);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

    // Session State
    const [session, setSession] = useState<SessionState | null>(null);
    const [phaseConfig, setPhaseConfig] = useState<Record<number, PhaseDefinition>>({});
    const [scoringInfo, setScoringInfo] = useState<ScoringInfo | null>(null);

    // Phase State
    const [phaseResult, setPhaseResult] = useState<SubmitPhaseResponse | null>(null);
    const [currentPhaseResponses, setCurrentPhaseResponsesInternal] = useState<PhaseResponse[]>([]);
    const [highestUnlockedPhase, setHighestUnlockedPhase] = useState(1);

    // Prompt & Image State
    const [curatedPrompt, setCuratedPrompt] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [activeRevealImage, setActiveRevealImage] = useState('');

    // =========================================================================
    // TOKEN CALCULATION (Display Only - Backend is authoritative)
    // =========================================================================
    const totalTokens = useMemo(() => {
        if (!session) return { payload: 0, ai: 0, total: 0 };

        // Backend provides accumulated totals - we just display them
        const cumulativeAI = session.total_tokens || 0;

        // Calculate payload from phase responses (user input tokens)
        const phasesPayload = Object.values(session.phases || {}).reduce((acc, p) => {
            return acc + (p.metrics?.tokens_used || 0);
        }, 0);

        return {
            payload: phasesPayload,
            ai: cumulativeAI,
            total: cumulativeAI + phasesPayload
        };
    }, [session]);

    // =========================================================================
    // PERSISTENCE EFFECTS
    // =========================================================================

    // Hydrate from localStorage on mount
    useEffect(() => {
        const validateAndHydrate = async () => {
            const savedSession = localStorage.getItem('pitch_sync_session');
            const savedConfig = localStorage.getItem('pitch_sync_config');
            const savedScoring = localStorage.getItem('pitch_sync_scoring');

            if (savedSession && savedConfig && savedScoring) {
                try {
                    const parsedSession = JSON.parse(savedSession);
                    const parsedConfig = JSON.parse(savedConfig);

                    // Validate session exists on backend
                    try {
                        const checkRes = await fetch(getApiUrl(`/api/session/${parsedSession.session_id}`));
                        if (!checkRes.ok) {
                            console.log("Session not found on backend, clearing localStorage");
                            localStorage.clear();
                            return;
                        }
                    } catch {
                        console.warn("Could not validate session with backend");
                    }

                    setSession(parsedSession);
                    setPhaseConfig(parsedConfig);
                    setScoringInfo(JSON.parse(savedScoring));

                    if (parsedSession.usecase) setSelectedUsecase(parsedSession.usecase);
                    if (parsedSession.theme_palette) setSelectedTheme(parsedSession.theme_palette);

                    if (parsedSession.final_output) {
                        if (parsedSession.final_output.image_prompt) setCuratedPrompt(parsedSession.final_output.image_prompt);
                        if (parsedSession.final_output.image_url) setGeneratedImageUrl(getFullUrl(parsedSession.final_output.image_url));
                    }

                    if (parsedSession.uploadedImages) {
                        const urls = parsedSession.uploadedImages.map((u: string) => getFullUrl(u));
                        setUploadedImages(urls);
                        if (urls.length > 0) setActiveRevealImage(urls[urls.length - 1]);
                    }

                    const unlocked = calculateHighestUnlockedPhase(
                        parsedSession.phase_scores || {},
                        parsedConfig,
                        parsedSession.is_complete || false
                    );
                    setHighestUnlockedPhase(unlocked);

                    // Restore current phase responses
                    if (parsedSession.phases) {
                        const currentPhaseNum = parsedSession.current_phase;
                        const phaseDef = parsedConfig[currentPhaseNum];
                        if (phaseDef) {
                            const phaseData = parsedSession.phases[phaseDef.name];
                            if (phaseData?.responses) {
                                setCurrentPhaseResponses(phaseData.responses);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to hydrate session", e);
                    localStorage.clear();
                }
            }
        };

        validateAndHydrate();
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        if (session) {
            localStorage.setItem('pitch_sync_session', JSON.stringify(session));
            localStorage.setItem('pitch_sync_config', JSON.stringify(phaseConfig));
            localStorage.setItem('pitch_sync_scoring', JSON.stringify(scoringInfo));
        }
    }, [session, phaseConfig, scoringInfo]);

    // Tactical Timer Management: Only pause when specifically LEAVING the war-room
    const lastPathname = useRef(location.pathname);
    useEffect(() => {
        const wasWarRoom = lastPathname.current === '/war-room';
        const isWarRoom = location.pathname === '/war-room';

        if (wasWarRoom && !isWarRoom) {
            console.log('[Timer] User left War Room, pausing tactical clock');
            pauseTimer();
        } else if (!wasWarRoom && isWarRoom) {
            console.log('[Timer] User entering War Room');
            // We don't auto-resume here because startPhase/initSession handle that
            // with more context (e.g. checking if phase is already passed)
        }

        lastPathname.current = location.pathname;
    }, [location.pathname, pauseTimer]);

    // =========================================================================
    // RESPONSE SETTER WITH TIMER LOGIC
    // =========================================================================
    const { timerState } = useTimer(); // Need this to check running state

    const setCurrentPhaseResponses = useCallback((responses: PhaseResponse[]) => {
        if (loading || phaseResult) {
            setCurrentPhaseResponsesInternal(responses);
            return;
        }

        // Use functional updates to avoid dependency on 'session'
        setSession(prev => {
            if (!prev) return null;

            const currentPhaseNum = prev.current_phase;
            const phaseName = currentPhaseNum ? phaseConfig[currentPhaseNum]?.name : null;
            if (!phaseName) return prev;

            const updatedPhases = { ...prev.phases };
            const phaseData = updatedPhases[phaseName];

            // Timer logic moved inside to be safe
            if (phaseData?.status === 'passed') {
                const existingResponses = phaseData.responses || [];
                const hasChanges = responses.some((r, i) => {
                    const existing = existingResponses[i];
                    return existing && (r.a !== existing.a || r.hint_used !== existing.hint_used);
                });

                if (hasChanges && timerState !== 'RUNNING') {
                    const storedDuration = phaseData.metrics?.duration_seconds || 0;
                    console.log(`[Timer] Edit detected on passed phase, starting timer from baseline: ${storedDuration}s`);
                    // We call startTimer here - it's stable
                    startTimer(Math.round(storedDuration));
                }
            }

            if (updatedPhases[phaseName]) {
                updatedPhases[phaseName] = {
                    ...updatedPhases[phaseName],
                    responses: responses
                };
            }
            return { ...prev, phases: updatedPhases };
        });

        setCurrentPhaseResponsesInternal(responses);
    }, [phaseConfig, loading, phaseResult, startTimer, timerState]);

    // =========================================================================
    // API ACTIONS
    // =========================================================================

    const initSession = useCallback(async (teamId: string) => {
        if (!selectedUsecase || !selectedTheme) return { success: false, isResumed: false, isComplete: false, currentPhase: 1 };

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(getApiUrl('/api/init'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team_id: teamId,
                    usecase_id: selectedUsecase.id,
                    theme_id: selectedTheme.id
                })
            });

            if (!res.ok) throw new Error('Failed to initialize session');

            const data: InitResponse = await res.json();
            const isResumedSession = !!(data.phase_scores && Object.keys(data.phase_scores).length > 0);

            const newSession: SessionState = {
                session_id: data.session_id,
                team_id: teamId,
                usecase: data.usecase,
                usecase_context: data.usecase.target_market,
                current_phase: data.current_phase || 1,
                phases: data.phase_data || {},
                theme_palette: data.theme,
                final_output: data.final_output || {
                    visionary_hook: '',
                    customer_pitch: '',
                    image_prompt: '',
                    image_url: '',
                    generated_at: null
                },
                total_score: Object.values(data.phase_scores || {}).reduce((a, b) => a + b, 0),
                phase_scores: data.phase_scores || {},
                created_at: new Date().toISOString(),
                completed_at: null,
                is_complete: data.is_complete || false,
                total_tokens: data.total_tokens || 0,
                extra_ai_tokens: data.extra_ai_tokens || 0,
                uploadedImages: data.uploadedImages || []
            };

            setSession(newSession);
            setPhaseConfig(data.phases);
            setScoringInfo(data.scoring_info);

            if (data.final_output) {
                if (data.final_output.image_prompt) setCuratedPrompt(data.final_output.image_prompt);
                if (data.final_output.image_url) setGeneratedImageUrl(getFullUrl(data.final_output.image_url));
            }

            const unlocked = calculateHighestUnlockedPhase(data.phase_scores || {}, data.phases, data.is_complete || false);
            setHighestUnlockedPhase(unlocked);

            // Timer initialization - handle both new and resumed sessions
            const phaseDef = data.phases[data.current_phase || 1];
            const phaseData = phaseDef ? data.phase_data?.[phaseDef.name] : null;
            const isPhaseComplete = phaseData?.status === 'passed';

            if (isPhaseComplete) {
                // Phase already complete - show the final duration
                stopTimer(Math.round(phaseData?.metrics?.duration_seconds || 0));
            } else if (data.current_phase_started_at) {
                // Resumed session with valid start time - calculate elapsed
                const serverStartTime = new Date(data.current_phase_started_at).getTime();
                const serverNow = data.current_server_time ? new Date(data.current_server_time).getTime() : Date.now();
                const elapsedSecs = Math.max(0, Math.floor((serverNow - serverStartTime) / 1000));
                console.log(`[Timer] Resuming session, elapsed: ${elapsedSecs}s`);
                startTimer(elapsedSecs);
            } else {
                // New session or missing start time - start fresh from 0
                console.log('[Timer] Starting fresh timer for new session');
                startTimer(0);
            }

            if (isResumedSession && data.phase_data) {
                const phaseDef = data.phases[data.current_phase || 1];
                if (phaseDef) {
                    const phaseData = data.phase_data[phaseDef.name];
                    if (phaseData?.responses) {
                        setCurrentPhaseResponses(phaseData.responses);
                    }
                }
            }

            setLoading(false);
            return {
                success: true,
                isResumed: isResumedSession,
                isComplete: data.is_complete || false,
                currentPhase: data.current_phase || 1
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
            return { success: false, isResumed: false, isComplete: false, currentPhase: 1 };
        }
    }, [selectedUsecase, selectedTheme, setLoading, setError, startTimer, stopTimer, setCurrentPhaseResponses]);

    const startPhase = useCallback(async (phaseNum: number) => {
        if (!session) return;

        const leavingPhaseNum = session.current_phase;
        const leavingElapsed = elapsedSeconds;
        pauseTimer();
        setPhaseResult(null);

        try {
            const res = await fetch(getApiUrl('/api/start-phase'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.session_id,
                    phase_number: phaseNum,
                    leaving_phase_number: leavingPhaseNum !== phaseNum ? leavingPhaseNum : null,
                    leaving_phase_elapsed_seconds: leavingPhaseNum !== phaseNum ? leavingElapsed : null,
                    leaving_phase_responses: leavingPhaseNum !== phaseNum ? currentPhaseResponses : null
                })
            });

            if (res.ok) {
                const data: StartPhaseResponse = await res.json();

                // Check phase status BEFORE updating state - use current session data
                const existingPhaseData = session?.phases[data.phase_name];
                const isPhaseAlreadyPassed = existingPhaseData?.status === 'passed';

                setSession(prev => {
                    if (!prev) return null;
                    const updatedPhases = { ...prev.phases };
                    if (data.previous_responses?.length && data.phase_name) {
                        const existingPhase = updatedPhases[data.phase_name];
                        if (!existingPhase || existingPhase.status !== 'passed') {
                            updatedPhases[data.phase_name] = {
                                ...(existingPhase || {
                                    phase_id: data.phase_id,
                                    metrics: {
                                        ai_score: 0,
                                        weighted_score: 0,
                                        start_time: null,
                                        end_time: null,
                                        duration_seconds: 0,
                                        retries: 0,
                                        tokens_used: 0,
                                        time_penalty: 0,
                                        retry_penalty: 0,
                                        hint_penalty: 0,
                                        efficiency_bonus: 0
                                    } as any
                                }),
                                status: 'in_progress' as any,
                                responses: data.previous_responses,
                                feedback: existingPhase?.feedback || '',
                                rationale: existingPhase?.rationale || '',
                                strengths: existingPhase?.strengths || [],
                                improvements: existingPhase?.improvements || []
                            };
                        }
                    }
                    return { ...prev, current_phase: phaseNum, phases: updatedPhases };
                });

                setCurrentPhaseResponsesInternal(data.previous_responses || []);

                // Use pre-computed phase status for timer logic
                if (isPhaseAlreadyPassed) {
                    const duration = existingPhaseData?.metrics?.duration_seconds || 0;
                    console.log(`[Timer] Phase ${phaseNum} already passed, showing duration: ${duration}s`);
                    stopTimer(Math.round(duration));
                } else {
                    console.log(`[Timer] Starting phase ${phaseNum} with elapsed: ${data.elapsed_seconds ?? 0}s`);
                    startTimer(data.elapsed_seconds ?? 0);
                }
            } else {
                console.error('Failed to start phase, status:', res.status);
            }
        } catch (e) {
            console.error("Failed to start phase", e);
        }
    }, [session, elapsedSeconds, currentPhaseResponses, pauseTimer, startTimer, stopTimer]);

    const submitPhase = useCallback(async (responses: PhaseResponse[]) => {
        if (!session) return;
        setLoading(true);
        stopTimer(); // Complete stop during evaluation as requested

        try {
            const currentPhaseDef = phaseConfig[session.current_phase];
            const res = await fetch(getApiUrl('/api/submit-phase'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.session_id,
                    phase_name: currentPhaseDef.name,
                    responses: responses,
                    time_taken_seconds: elapsedSeconds
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Submission failed');
            }

            const result: SubmitPhaseResponse = await res.json();

            // Update session with backend-provided values (backend is authoritative)
            setSession(prev => {
                if (!prev) return null;

                // Preserve existing history
                const currentPhaseDef = phaseConfig[prev.current_phase];
                const existingPhase = prev.phases[currentPhaseDef.name];
                const existingHistory = existingPhase?.history || [];
                const newHistory = [...existingHistory];

                // Only add to history if there was a REAL retry (responses changed)
                const existingResponses = existingPhase?.responses || [];
                const hasChanges = responses.some((r, i) => {
                    const existing = existingResponses[i];
                    return !existing || r.a !== existing.a || r.hint_used !== existing.hint_used;
                });

                // If there was a previous attempt with a valid score AND responses changed, add it to history
                if (hasChanges && existingPhase?.metrics && typeof existingPhase.metrics.weighted_score === 'number') {
                    newHistory.push(existingPhase.metrics);
                }

                return {
                    ...prev,
                    total_score: result.total_score,
                    total_tokens: result.total_tokens || prev.total_tokens,
                    extra_ai_tokens: result.extra_ai_tokens || prev.extra_ai_tokens,
                    phase_scores: {
                        ...prev.phase_scores,
                        [currentPhaseDef.name]: result.phase_score
                    },
                    phases: {
                        ...prev.phases,
                        [currentPhaseDef.name]: {
                            phase_id: currentPhaseDef.id,
                            status: (result.passed ? 'passed' : 'failed') as any,
                            responses: responses,
                            metrics: {
                                ai_score: result.ai_score,
                                weighted_score: result.phase_score,
                                start_time: null,
                                end_time: new Date().toISOString(),
                                duration_seconds: elapsedSeconds,
                                retries: result.metrics.retries,
                                tokens_used: result.metrics.tokens_used,
                                time_penalty: result.metrics.time_penalty,
                                retry_penalty: result.metrics.retry_penalty,
                                hint_penalty: result.metrics.hint_penalty,
                                efficiency_bonus: result.metrics.efficiency_bonus,
                                input_tokens: result.metrics.input_tokens,
                                output_tokens: result.metrics.output_tokens
                            },
                            feedback: result.feedback,
                            rationale: result.rationale,
                            strengths: result.strengths,
                            improvements: result.improvements,
                            history: newHistory
                        }
                    }
                };
            });

            if (result.passed) {
                setHighestUnlockedPhase(prev => Math.max(prev, session.current_phase + 1));
            }

            setPhaseResult(result);
            setCurrentPhaseResponsesInternal(responses);
            stopTimer();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error submitting phase');
            resumeTimer(); // Resume timer if submission failed so player can fix and retry
        } finally {
            setLoading(false);
        }
    }, [session, phaseConfig, elapsedSeconds, pauseTimer, resumeTimer, stopTimer, setLoading, setError]);

    const handleFeedbackAction = useCallback(async (action: 'CONTINUE' | 'RETRY'): Promise<{ navigateTo?: string }> => {
        if (!phaseResult || !session) return {};

        if (action === 'RETRY') {
            setPhaseResult(null);
            await startPhase(session.current_phase);
            return {};
        } else {
            if (phaseResult.is_final_phase) {
                setHighestUnlockedPhase(Object.keys(phaseConfig).length + 1);
                setPhaseResult(null);
                stopTimer();
                await curatePrompt();
                return { navigateTo: '/curate' };
            } else {
                setPhaseResult(null);
                await startPhase(session.current_phase + 1);
                return {};
            }
        }
    }, [phaseResult, session, phaseConfig, startPhase, stopTimer]);

    const curatePrompt = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const res = await fetch(getApiUrl('/api/curate-prompt'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: session.session_id })
            });

            if (res.ok) {
                const data = await res.json();
                setCuratedPrompt(data.curated_prompt || '');
                setSession(prev => prev ? {
                    ...prev,
                    final_output: { ...prev.final_output, image_prompt: data.curated_prompt },
                    extra_ai_tokens: data.extra_ai_tokens
                } : null);
            }
        } catch (e) {
            console.error("Failed to curate prompt", e);
        } finally {
            setLoading(false);
        }
    }, [session, setLoading]);

    const regeneratePrompt = useCallback(async (
        additionalNotes: string,
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    ) => {
        if (!session) return;
        setLoading(true);

        try {
            const historyContext = conversationHistory
                .filter(m => m.role === 'user')
                .map(m => m.content)
                .join(' | ');

            const fullNotes = historyContext
                ? `${historyContext}${additionalNotes ? ' | ' + additionalNotes : ''}`
                : additionalNotes;

            const res = await fetch(getApiUrl('/api/curate-prompt'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.session_id,
                    additional_notes: fullNotes || null
                })
            });

            if (res.ok) {
                const data = await res.json();
                setCuratedPrompt(data.curated_prompt || '');
                setSession(prev => prev ? {
                    ...prev,
                    final_output: { ...prev.final_output, image_prompt: data.curated_prompt },
                    extra_ai_tokens: data.extra_ai_tokens,
                    total_tokens: data.total_tokens
                } : null);
            }
        } catch (e) {
            console.error("Failed to regenerate prompt", e);
        } finally {
            setLoading(false);
        }
    }, [session, setLoading]);

    const submitPitchImage = useCallback(async (finalPrompt: string, file: File) => {
        if (!session) return;
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('session_id', session.session_id);
            formData.append('edited_prompt', finalPrompt);
            formData.append('file', file);

            const res = await fetch(getApiUrl('/api/submit-pitch-image'), {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                const url = getFullUrl(data.image_url || '');

                setGeneratedImageUrl(url);
                setCuratedPrompt(data.prompt_used || finalPrompt);

                // Backend provides authoritative totals
                setSession(prev => prev ? {
                    ...prev,
                    total_score: data.total_score,
                    total_tokens: data.total_tokens,
                    is_complete: true,
                    final_output: {
                        ...prev.final_output,
                        image_url: url,
                        image_prompt: data.prompt_used || finalPrompt,
                        generated_at: new Date().toISOString()
                    },
                    extra_ai_tokens: data.extra_ai_tokens,
                    uploadedImages: [...(prev.uploadedImages || []), url].slice(-3)
                } : null);

                setUploadedImages(prev => [...prev, url].slice(-3));
                setActiveRevealImage(url);
            }
        } catch (e) {
            console.error("Failed to submit pitch image", e);
        } finally {
            setLoading(false);
        }
    }, [session, setLoading]);

    const resetToStart = useCallback(() => {
        localStorage.removeItem('pitch_sync_session');
        localStorage.removeItem('pitch_sync_config');
        localStorage.removeItem('pitch_sync_scoring');

        setSession(null);
        setSelectedUsecase(null);
        setSelectedTheme(null);
        setPhaseResult(null);
        setHighestUnlockedPhase(1);
        stopTimer();
        setCuratedPrompt('');
        setGeneratedImageUrl('');
    }, [stopTimer]);

    // =========================================================================
    // CONTEXT VALUE
    // =========================================================================
    return (
        <SessionContext.Provider value={{
            selectedUsecase,
            selectedTheme,
            setSelectedUsecase,
            setSelectedTheme,
            session,
            phaseConfig,
            scoringInfo,
            highestUnlockedPhase,
            phaseResult,
            setPhaseResult,
            currentPhaseResponses,
            setCurrentPhaseResponses,
            curatedPrompt,
            setCuratedPrompt,
            generatedImageUrl,
            uploadedImages,
            activeRevealImage,
            setActiveRevealImage,
            totalTokens,
            initSession,
            startPhase,
            submitPhase,
            handleFeedbackAction,
            curatePrompt,
            regeneratePrompt,
            submitPitchImage,
            resetToStart
        }}>
            {children}
        </SessionContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================
export const useSession = (): SessionContextType => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
