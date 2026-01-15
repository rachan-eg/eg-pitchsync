import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiUrl, getFullUrl } from './utils';
import type {
    UseCase, Theme, SessionState, PhaseDefinition, ScoringInfo,
    InitResponse, StartPhaseResponse, SubmitPhaseResponse, PhaseResponse,
    LeaderboardEntry, LeaderboardResponse
} from './types';

// =============================================================================
// HELPER: Calculate highest unlocked phase from phase_scores
// =============================================================================
const calculateHighestUnlockedPhase = (
    phaseScores: Record<string, number>,
    phaseConfig: Record<number, PhaseDefinition>,
    isComplete: boolean
): number => {
    // If session is complete, all phases + final are unlocked
    const totalPhases = Object.keys(phaseConfig).length;
    if (isComplete) {
        return totalPhases + 1;
    }

    // Count how many phases have scores (meaning they were passed)
    const completedCount = Object.keys(phaseScores).length;

    return Math.max(1, completedCount + 1);
};

/**
 * Calculates total tokens (Strategic + AI Agent) across all session phases.
 */
const calculateTotalTokens = (session: SessionState | null): { payload: number; ai: number; total: number } => {
    if (!session) return { payload: 0, ai: 0, total: 0 };

    // The backend now provides an accumulated total_tokens that includes all retries,
    // curation edits, and image generation attempts. This is the 'AI Agent' total.
    const cumulativeAI = session.total_tokens || 0;

    // The 'Strategic Payload' represents the data throughput of the latest phase answers.
    const phasesTotal = Object.values(session.phases || {}).reduce((acc, p) => {
        const payload = p.metrics?.tokens_used || 0;
        return {
            payload: acc.payload + payload
        };
    }, { payload: 0 });

    return {
        payload: phasesTotal.payload,
        ai: cumulativeAI,
        // Grand total is the sum of both resource channels
        total: cumulativeAI + phasesTotal.payload
    };
};

// =============================================================================
// CONTEXT TYPES
// =============================================================================
interface AppContextType {
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
    elapsedSeconds: number;

    // Prompt & Image State
    curatedPrompt: string;
    setCuratedPrompt: (prompt: string) => void;
    generatedImageUrl: string;

    // UI State
    loading: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    leaderboard: LeaderboardEntry[];
    showLeaderboard: boolean;
    setShowLeaderboard: (show: boolean) => void;
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
    fetchLeaderboard: () => Promise<void>;
    resumeTimer: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

// =============================================================================
// CONTEXT PROVIDER
// =============================================================================
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const location = useLocation();
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

    // Timer State (Revamped - Simple & Reliable)
    // timerState: 'STOPPED' | 'RUNNING' | 'PAUSED'
    // - STOPPED: Timer is not active (phase complete or not started)
    // - RUNNING: Timer is actively counting
    // - PAUSED: Timer is paused (e.g., viewing feedback, loading)
    const [timerState, setTimerState] = useState<'STOPPED' | 'RUNNING' | 'PAUSED'>('STOPPED');
    const [timerBaseSeconds, setTimerBaseSeconds] = useState(0); // Accumulated seconds before current run
    const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null); // When current run started (Date.now())
    const [elapsedSeconds, setElapsedSeconds] = useState(0); // Display value = timerBaseSeconds + current run


    // Prompt & Image State
    const [curatedPrompt, setCuratedPrompt] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    // =========================================================================
    // EFFECTS
    // =========================================================================

    // On Mount: Try to hydrate from localStorage (with backend validation)
    useEffect(() => {
        const validateAndHydrate = async () => {
            const savedSession = localStorage.getItem('pitch_sync_session');
            const savedConfig = localStorage.getItem('pitch_sync_config');
            const savedScoring = localStorage.getItem('pitch_sync_scoring');

            if (savedSession && savedConfig && savedScoring) {
                try {
                    const parsedSession = JSON.parse(savedSession);
                    const parsedConfig = JSON.parse(savedConfig);

                    // VALIDATE: Check if session exists on backend (handles fresh DB deployments)
                    try {
                        const checkRes = await fetch(getApiUrl(`/api/session/${parsedSession.session_id}`));
                        if (!checkRes.ok) {
                            console.log("Session not found on backend (fresh deployment?), clearing localStorage");
                            localStorage.clear();
                            return;
                        }
                    } catch {
                        // Backend might be down, proceed with caution
                        console.warn("Could not validate session with backend");
                    }

                    setSession(parsedSession);
                    setPhaseConfig(parsedConfig);
                    setScoringInfo(JSON.parse(savedScoring));

                    // Restore selection state for smooth resumes
                    if (parsedSession.usecase) setSelectedUsecase(parsedSession.usecase);
                    if (parsedSession.theme_palette) setSelectedTheme(parsedSession.theme_palette);

                    // Restore curated prompt and image URL
                    if (parsedSession.final_output) {
                        if (parsedSession.final_output.image_prompt) setCuratedPrompt(parsedSession.final_output.image_prompt);
                        if (parsedSession.final_output.image_url) setGeneratedImageUrl(getFullUrl(parsedSession.final_output.image_url));
                    }

                    // CRITICAL FIX: Always derive highest unlocked phase from phase_scores
                    // This ensures consistency with the database state
                    const unlocked = calculateHighestUnlockedPhase(
                        parsedSession.phase_scores || {},
                        parsedConfig,
                        parsedSession.is_complete || false
                    );
                    setHighestUnlockedPhase(unlocked);

                    // CRITICAL FIX: Hydrate currentPhaseResponses from session data
                    // This ensures answers are visible immediately on refresh/resume
                    if (parsedSession.phases) {
                        const currentPhaseNum = parsedSession.current_phase;
                        const config = parsedConfig; // Use the config we just loaded
                        const phaseDef = config[currentPhaseNum];

                        if (phaseDef) {
                            const phaseName = phaseDef.name;
                            const phaseData = parsedSession.phases[phaseName];
                            if (phaseData && phaseData.responses) {
                                setCurrentPhaseResponses(phaseData.responses);
                            }
                        } else {
                            // Fallback: search by phase_id string if needed, or loosely
                            // But usually phases are indexed by number in config
                            const pData = Object.values(parsedSession.phases).find((p: any) => p.phase_id === `phase_${currentPhaseNum}`);
                            if (pData && (pData as any).responses) {
                                setCurrentPhaseResponses((pData as any).responses);
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

    // On Change: Persist to localStorage
    useEffect(() => {
        if (session) {
            localStorage.setItem('pitch_sync_session', JSON.stringify(session));
            localStorage.setItem('pitch_sync_config', JSON.stringify(phaseConfig));
            localStorage.setItem('pitch_sync_scoring', JSON.stringify(scoringInfo));
            // Note: We no longer persist highestUnlockedPhase separately
            // It's always derived from phase_scores for consistency
        }
    }, [session, phaseConfig, scoringInfo]);

    // =========================================================================
    // TIMER CONTROL FUNCTIONS (New Simplified Architecture)
    // =========================================================================
    const startTimer = useCallback((baseSeconds: number = 0) => {
        setTimerBaseSeconds(baseSeconds);
        setTimerStartedAt(Date.now());
        setElapsedSeconds(baseSeconds);
        setTimerState('RUNNING');
    }, []);

    const pauseTimer = useCallback(() => {
        if (timerState === 'RUNNING' && timerStartedAt) {
            // Save current elapsed to base before pausing
            const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
            setTimerBaseSeconds(prev => prev + currentRun);
            setTimerStartedAt(null);
        }
        setTimerState('PAUSED');
    }, [timerState, timerStartedAt]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const resumeTimer = useCallback(() => {
        if (timerState === 'PAUSED') {
            setTimerStartedAt(Date.now());
            setTimerState('RUNNING');
        }
    }, [timerState]);

    const stopTimer = useCallback((finalSeconds?: number) => {
        if (finalSeconds !== undefined) {
            setElapsedSeconds(finalSeconds);
            setTimerBaseSeconds(finalSeconds);
        } else if (timerStartedAt) {
            const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
            const total = timerBaseSeconds + currentRun;
            setElapsedSeconds(total);
            setTimerBaseSeconds(total);
        }
        setTimerStartedAt(null);
        setTimerState('STOPPED');
    }, [timerStartedAt, timerBaseSeconds]);

    // Timer tick effect - simple and reliable
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        if (timerState === 'RUNNING' && timerStartedAt) {
            interval = setInterval(() => {
                // Only tick if document is visible
                if (document.visibilityState === 'visible') {
                    const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
                    setElapsedSeconds(timerBaseSeconds + currentRun);
                }
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [timerState, timerStartedAt, timerBaseSeconds]);

    // Pause timer when leaving war-room
    useEffect(() => {
        const isWarRoom = location.pathname === '/war-room';
        if (!isWarRoom && timerState === 'RUNNING') {
            pauseTimer();
        }
    }, [location.pathname, timerState, pauseTimer]);

    // Pause timer when showing results or loading
    useEffect(() => {
        if ((phaseResult || loading) && timerState === 'RUNNING') {
            pauseTimer();
        }
    }, [phaseResult, loading, timerState, pauseTimer]);

    // Wrapper for setCurrentPhaseResponses - manages timer for editing completed phases
    const setCurrentPhaseResponses = useCallback((responses: PhaseResponse[]) => {
        // Prevent timer logic from triggering during submission or while result modal is open
        if (loading || phaseResult) {
            setCurrentPhaseResponsesInternal(responses);
            return;
        }

        // Check if current phase is completed (passed)
        const currentPhaseNum = session?.current_phase;
        const phaseName = currentPhaseNum ? phaseConfig[currentPhaseNum]?.name : null;
        const phaseData = phaseName ? session?.phases[phaseName] : null;
        const isPhasePassed = phaseData?.status === 'passed';

        if (isPhasePassed) {
            const existingResponses = phaseData?.responses || [];
            const hasChanges = responses.some((r, i) => {
                const existing = existingResponses[i];
                return existing && (r.a !== existing.a || r.hint_used !== existing.hint_used);
            });

            if (hasChanges && timerState === 'STOPPED') {
                // User started editing a completed phase - START the timer from stored duration
                const storedDuration = phaseData?.metrics?.duration_seconds || 0;
                startTimer(Math.round(storedDuration));
            } else if (!hasChanges && timerState === 'RUNNING') {
                // User reverted changes back to original - STOP the timer and show stored duration
                const storedDuration = phaseData?.metrics?.duration_seconds || 0;
                stopTimer(Math.round(storedDuration));
            }
        }

        setCurrentPhaseResponsesInternal(responses);
    }, [session, phaseConfig, timerState, loading, phaseResult, startTimer, stopTimer]);

    // Fetch leaderboard periodically
    useEffect(() => {
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    // =========================================================================
    // API FUNCTIONS
    // =========================================================================

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
                const prompt = data.curated_prompt || '';
                setCuratedPrompt(prompt);

                setSession(prev => prev ? {
                    ...prev,
                    final_output: { ...prev.final_output, image_prompt: prompt },
                    extra_ai_tokens: data.extra_ai_tokens
                } : null);
            }
        } catch (e) {
            console.error("Failed to curate prompt", e);
        } finally {
            setLoading(false);
        }
    }, [session]);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await fetch(getApiUrl('/api/leaderboard'));
            if (res.ok) {
                const data: LeaderboardResponse = await res.json();
                setLeaderboard(data.entries);
            }
        } catch (e) {
            console.error("Failed to fetch leaderboard", e);
        }
    }, []);

    const initSession = useCallback(async (teamId: string): Promise<{ success: boolean; isResumed: boolean; isComplete: boolean; currentPhase: number }> => {
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
                extra_ai_tokens: data.extra_ai_tokens || 0
            };

            setSession(newSession);
            setPhaseConfig(data.phases);
            setScoringInfo(data.scoring_info);

            if (data.final_output) {
                if (data.final_output.image_prompt) {
                    setCuratedPrompt(data.final_output.image_prompt);
                }
                if (data.final_output.image_url) {
                    setGeneratedImageUrl(getFullUrl(data.final_output.image_url));
                }
            }

            const unlocked = calculateHighestUnlockedPhase(
                data.phase_scores || {},
                data.phases,
                data.is_complete || false
            );
            setHighestUnlockedPhase(unlocked);

            if (data.current_phase_started_at) {
                // Timer Sync (Resume) - Using new simplified timer
                const currentPhaseNum = data.current_phase || 1;
                const resumePhaseConfig = data.phases;
                const phaseDef = resumePhaseConfig[currentPhaseNum];

                let isComplete = false;
                let storedDuration = 0;

                if (phaseDef) {
                    const phaseName = phaseDef.name;
                    const phaseData = data.phase_data?.[phaseName];
                    if (phaseData && phaseData.status === 'passed') {
                        isComplete = true;
                        storedDuration = phaseData.metrics?.duration_seconds || 0;
                    }
                }

                if (isComplete) {
                    // Phase is complete - stop timer and show stored duration
                    stopTimer(Math.round(storedDuration));
                } else {
                    // Phase in progress - calculate elapsed and start timer
                    const serverStartTime = new Date(data.current_phase_started_at).getTime();
                    const serverNow = data.current_server_time ? new Date(data.current_server_time).getTime() : Date.now();
                    const elapsedSecs = Math.max(0, Math.floor((serverNow - serverStartTime) / 1000));
                    startTimer(elapsedSecs);
                }
            }

            // CRITICAL FIX: Set current responses if resuming
            if (isResumedSession && data.phase_data) {
                const currentPhaseNum = data.current_phase || 1;
                const phaseConfig = data.phases;
                const phaseDef = phaseConfig[currentPhaseNum];
                if (phaseDef) {
                    const phaseName = phaseDef.name;
                    const phaseData = data.phase_data[phaseName];
                    if (phaseData && phaseData.responses) {
                        setCurrentPhaseResponses(phaseData.responses);
                    }
                }
            }

            console.log(`Session ${isResumedSession ? 'resumed' : 'created'}:`, {
                phase_scores: data.phase_scores,
                current_phase: data.current_phase,
                calculated_unlocked: unlocked,
                is_complete: data.is_complete
            });

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
    }, [selectedUsecase, selectedTheme]);

    const startPhase = useCallback(async (phaseNum: number) => {
        if (!session) return;

        // Capture current phase's elapsed time BEFORE pausing
        const leavingPhaseNum = session.current_phase;
        const leavingElapsed = elapsedSeconds;

        // IMMEDIATELY pause the current timer
        pauseTimer();

        // Clear previous phase result when switching phases
        setPhaseResult(null);

        // Now fetch the new phase data from server
        try {
            const res = await fetch(getApiUrl('/api/start-phase'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.session_id,
                    phase_number: phaseNum,
                    // Send current phase's elapsed time so server can save it
                    leaving_phase_number: leavingPhaseNum !== phaseNum ? leavingPhaseNum : null,
                    leaving_phase_elapsed_seconds: leavingPhaseNum !== phaseNum ? leavingElapsed : null,
                    leaving_phase_responses: leavingPhaseNum !== phaseNum ? currentPhaseResponses : null
                })
            });

            if (res.ok) {
                const data: StartPhaseResponse = await res.json();

                // Update session first, including any draft responses
                setSession(prev => {
                    if (!prev) return null;

                    // If we have previous responses, save them to the phases for localStorage fallback
                    const updatedPhases = { ...prev.phases };
                    if (data.previous_responses && data.previous_responses.length > 0 && data.phase_name) {
                        // Update or create the phase entry with draft responses
                        const existingPhase = updatedPhases[data.phase_name];
                        if (existingPhase) {
                            // Only update responses if the phase isn't already passed
                            if (existingPhase.status !== 'passed') {
                                updatedPhases[data.phase_name] = {
                                    ...existingPhase,
                                    responses: data.previous_responses
                                };
                            }
                        } else {
                            // Create new draft entry
                            updatedPhases[data.phase_name] = {
                                phase_id: data.phase_id,
                                status: 'in_progress' as any,
                                responses: data.previous_responses,
                                metrics: {} as any,
                                feedback: '',
                                rationale: '',
                                strengths: [],
                                improvements: []
                            };
                        }
                    }

                    return { ...prev, current_phase: phaseNum, phases: updatedPhases };
                });
                setCurrentPhaseResponses(data.previous_responses || []);

                // CHECK: Is this phase already completed (passed)?
                // If so, show stored duration and keep timer STOPPED
                // Timer will only start when user makes changes (handled separately)
                const phaseData = session?.phases[data.phase_name];
                const isPhasePassed = phaseData?.status === 'passed';

                if (isPhasePassed) {
                    // Phase is completed - show stored duration, timer STOPPED
                    const storedDuration = phaseData?.metrics?.duration_seconds || 0;
                    stopTimer(Math.round(storedDuration));
                } else {
                    // Phase is in progress - start timer from accumulated point
                    const accumulatedSeconds = data.elapsed_seconds ?? 0;
                    startTimer(accumulatedSeconds);
                }
            }
        } catch (e) {
            console.error("Failed to start phase", e);
        }
    }, [session, elapsedSeconds, currentPhaseResponses, pauseTimer, startTimer, stopTimer]);

    const submitPhase = useCallback(async (responses: PhaseResponse[]) => {
        if (!session) return;
        setLoading(true);
        pauseTimer(); // Added explicit pause to ensure timer stops visually immediately
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

            setSession(prev => {
                if (!prev) return null;
                const updatedPhaseScores = {
                    ...prev.phase_scores,
                    [currentPhaseDef.name]: result.phase_score
                };

                // Preserve existing history
                const existingPhase = prev.phases[currentPhaseDef.name];
                const existingHistory = existingPhase?.history || [];
                const newHistory = [...existingHistory];

                // Only add to history if there was a REAL retry (responses changed)
                // Don't add when just clicking "Review Evaluation" (same responses)
                const existingResponses = existingPhase?.responses || [];
                const hasChanges = responses.some((r, i) => {
                    const existing = existingResponses[i];
                    return !existing || r.a !== existing.a || r.hint_used !== existing.hint_used;
                });

                // If there was a previous attempt with a valid score AND responses changed, add it to history
                // We check if weighted_score is a number to ensure we have a valid previous attempt to store
                if (hasChanges && existingPhase?.metrics && typeof existingPhase.metrics.weighted_score === 'number') {
                    newHistory.push(existingPhase.metrics);
                }

                const updatedPhases = {
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
                };

                return {
                    ...prev,
                    total_score: result.total_score,
                    total_tokens: result.total_tokens || prev.total_tokens,
                    extra_ai_tokens: result.extra_ai_tokens || prev.extra_ai_tokens,
                    phase_scores: updatedPhaseScores,
                    phases: updatedPhases
                };
            });

            if (result.passed) {
                const currentPhaseNum = session.current_phase;
                const nextPhase = currentPhaseNum + 1;
                setHighestUnlockedPhase(prev => Math.max(prev, nextPhase));
            }

            setPhaseResult(result);
            setCurrentPhaseResponses(responses);
            // Stop the timer after successful submission
            stopTimer();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error submitting phase');
            resumeTimer(); // Resume timer if submission failed so player can fix and retry
        } finally {
            setLoading(false);
        }
    }, [session, phaseConfig, elapsedSeconds, pauseTimer, stopTimer]);

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
    }, [phaseResult, session, phaseConfig, startPhase, curatePrompt]);

    const regeneratePrompt = useCallback(async (additionalNotes: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []) => {
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
                const prompt = data.curated_prompt || '';
                setCuratedPrompt(prompt);

                // Update session state
                setSession(prev => prev ? {
                    ...prev,
                    final_output: { ...prev.final_output, image_prompt: prompt },
                    extra_ai_tokens: data.extra_ai_tokens,
                    total_tokens: data.total_tokens
                } : null);
            }
        } catch (e) {
            console.error("Failed to regenerate prompt", e);
        } finally {
            setLoading(false);
        }
    }, [session]);

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
                const promptUsed = data.prompt_used || finalPrompt;

                setGeneratedImageUrl(url);
                setCuratedPrompt(promptUsed);

                setSession(prev => prev ? {
                    ...prev,
                    total_score: data.total_score,
                    total_tokens: data.total_tokens,
                    is_complete: true,
                    final_output: {
                        ...prev.final_output,
                        image_url: url,
                        image_prompt: promptUsed,
                        generated_at: new Date().toISOString()
                    },
                    extra_ai_tokens: data.extra_ai_tokens
                } : null);
            }
        } catch (e) {
            console.error("Failed to submit pitch image", e);
        } finally {
            setLoading(false);
        }
    }, [session]);

    const resetToStart = () => {
        localStorage.removeItem('pitch_sync_session');
        localStorage.removeItem('pitch_sync_config');
        localStorage.removeItem('pitch_sync_scoring');

        setSession(null);
        setSelectedUsecase(null);
        setSelectedTheme(null);
        setPhaseResult(null);
        setHighestUnlockedPhase(1);
        setElapsedSeconds(0);
        stopTimer();
        setCuratedPrompt('');
        setGeneratedImageUrl('');
    };

    const totalTokens = React.useMemo(() => calculateTotalTokens(session), [session]);

    // =========================================================================
    // CONTEXT VALUE
    // =========================================================================
    const value: AppContextType = {
        // Selection
        selectedUsecase,
        selectedTheme,
        setSelectedUsecase,
        setSelectedTheme,

        // Session
        session,
        phaseConfig,
        scoringInfo,
        highestUnlockedPhase,

        // Phase
        phaseResult,
        setPhaseResult,
        currentPhaseResponses,
        setCurrentPhaseResponses,
        elapsedSeconds,

        // Prompt & Image
        curatedPrompt,
        setCuratedPrompt,
        generatedImageUrl,

        // UI
        loading,
        error,
        setError,
        leaderboard,
        showLeaderboard,
        setShowLeaderboard,
        totalTokens,

        // Actions
        initSession,
        startPhase,
        submitPhase,
        handleFeedbackAction,
        curatePrompt,
        regeneratePrompt,
        submitPitchImage,
        resetToStart,
        fetchLeaderboard,
        resumeTimer
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// =============================================================================
// HOOK
// =============================================================================
export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
