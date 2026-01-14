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
    initSession: (teamId: string) => Promise<{ success: boolean; isResumed: boolean; isComplete: boolean }>;
    startPhase: (phaseNum: number) => Promise<void>;
    submitPhase: (responses: PhaseResponse[]) => Promise<void>;
    handleFeedbackAction: (action: 'CONTINUE' | 'RETRY') => Promise<{ navigateTo?: string }>;
    curatePrompt: () => Promise<void>;
    regeneratePrompt: (additionalNotes: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<void>;
    submitPitchImage: (finalPrompt: string, file: File) => Promise<void>;
    resetToStart: () => void;
    fetchLeaderboard: () => Promise<void>;
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
    const [currentPhaseResponses, setCurrentPhaseResponses] = useState<PhaseResponse[]>([]);
    const [highestUnlockedPhase, setHighestUnlockedPhase] = useState(1);

    // Timer State
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);

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

    // Timer logic - runs when in phase and no result shown
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        const isWarRoom = location.pathname === '/war-room';

        // Check if current phase is already completed
        const currentPhaseNum = session?.current_phase;
        const phaseName = currentPhaseNum ? phaseConfig[currentPhaseNum]?.name : null;
        const isPhaseComplete = phaseName && session?.phases[phaseName]?.status === 'passed';

        if (session && phaseStartTime && !phaseResult && !loading && isWarRoom && !isPhaseComplete) {
            interval = setInterval(() => {
                // Only tick if the document is visible
                if (document.visibilityState === 'visible') {
                    setElapsedSeconds(Math.floor((Date.now() - phaseStartTime) / 1000));
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [session, phaseStartTime, phaseResult, loading, location.pathname]);

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

    const initSession = useCallback(async (teamId: string): Promise<{ success: boolean; isResumed: boolean; isComplete: boolean }> => {
        if (!selectedUsecase || !selectedTheme) return { success: false, isResumed: false, isComplete: false };

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
                // Robust Timer Sync (Resume)
                const serverStartTime = new Date(data.current_phase_started_at).getTime();
                const serverNow = data.current_server_time ? new Date(data.current_server_time).getTime() : Date.now();

                const elapsedMs = Math.max(0, serverNow - serverStartTime);
                const localStartTime = Date.now() - elapsedMs;

                setPhaseStartTime(localStartTime);
                setElapsedSeconds(Math.floor(elapsedMs / 1000));
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
                isComplete: data.is_complete || false
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
            return { success: false, isResumed: false, isComplete: false };
        }
    }, [selectedUsecase, selectedTheme]);

    const startPhase = useCallback(async (phaseNum: number) => {
        if (!session) return;

        // Capture current phase's elapsed time BEFORE clearing state
        const leavingPhaseNum = session.current_phase;
        const leavingElapsed = elapsedSeconds;

        // IMMEDIATELY stop the current timer by clearing phaseStartTime
        // This prevents the old phase's timer from continuing to tick
        setPhaseStartTime(null);

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

                // Use the accumulated elapsed_seconds from the server (pause/resume)
                // This is the total time spent on this phase across all sessions
                const accumulatedSeconds = data.elapsed_seconds ?? 0;

                // Set local start time based on accumulated time
                // Timer will resume from where we left off
                const localStartTime = Date.now() - (accumulatedSeconds * 1000);

                // Update session first
                setSession(prev => prev ? { ...prev, current_phase: phaseNum } : null);
                setCurrentPhaseResponses(data.previous_responses || []);

                // Set elapsed BEFORE phaseStartTime to avoid a flicker
                setElapsedSeconds(accumulatedSeconds);
                // Now start the timer from the accumulated point
                setPhaseStartTime(localStartTime);
            }
        } catch (e) {
            console.error("Failed to start phase", e);
        }
    }, [session, elapsedSeconds]);

    const submitPhase = useCallback(async (responses: PhaseResponse[]) => {
        if (!session) return;
        setLoading(true);

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
                        improvements: result.improvements
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error submitting phase');
        } finally {
            setLoading(false);
        }
    }, [session, phaseConfig, elapsedSeconds]);

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
                setPhaseStartTime(null);
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
        setPhaseStartTime(null);
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
        fetchLeaderboard
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
