/**
 * Pitch-Sync Platform - TypeScript Type Definitions
 * Blueprint-compliant interfaces for full type safety
 */

// =============================================================================
// CORE DOMAIN TYPES
// =============================================================================

export interface Theme {
    id: string;
    name: string;
    visual_style: string;
    colors: {
        primary: string;
        secondary: string;
        bg: string;
    };
    mood: string;
}

export interface UseCase {
    id: string;
    title: string;
    domain: string;
    complexity: string;
    target_market: string;
    description?: string;
    icon?: string;
}

export interface Question {
    id: string;
    text: string;
    criteria: string;
    hint_text?: string;
    hint_criteria?: string;
    hint_penalty?: number;
}

export interface PhaseDefinition {
    id: string;
    name: string;
    description: string;
    weight: number;
    time_limit_seconds: number;
    questions: Question[];
}

// =============================================================================
// PHASE & SESSION STATE
// =============================================================================

export type PhaseStatus = 'pending' | 'in_progress' | 'submitted' | 'passed' | 'failed';

export interface PhaseMetrics {
    ai_score: number;
    weighted_score: number;
    start_time: string | null;
    end_time: string | null;
    duration_seconds: number;
    retries: number;
    tokens_used: number;
    input_tokens?: number;
    output_tokens?: number;
    time_penalty: number;
    retry_penalty: number;
    hint_penalty: number;
    efficiency_bonus: number;
}

export interface PhaseResponse {
    q: string;
    a: string;
    question_id?: string;
    hint_used?: boolean;
}

export interface PhaseData {
    phase_id: string;
    status: PhaseStatus;
    responses: PhaseResponse[];
    metrics: PhaseMetrics;
    feedback: string | null;
    rationale: string | null;
    strengths: string[];
    improvements: string[];
    history?: PhaseMetrics[];
}

export interface FinalOutput {
    visionary_hook: string;
    customer_pitch: string;
    image_prompt: string;
    image_url: string;
    generated_at: string | null;
}

export interface SessionState {
    session_id: string;
    team_id: string;
    usecase: UseCase;
    usecase_context: string;
    current_phase: number;
    phases: Record<string, PhaseData>;
    theme_palette: Theme;
    final_output: FinalOutput;
    total_score: number;
    phase_scores: Record<string, number>;
    created_at: string;
    completed_at: string | null;
    is_complete: boolean;
    total_tokens: number;
    extra_ai_tokens?: number;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface InitRequest {
    team_id: string;
}

export interface ScoringInfo {
    max_ai_points: number;
    retry_penalty: number;
    max_retries: number;
    time_penalty_max: number;
    efficiency_bonus: string;
    pass_threshold: number;
}

export interface InitResponse {
    session_id: string;
    usecase: UseCase;
    theme: Theme;
    phases: Record<number, PhaseDefinition>;
    scoring_info: ScoringInfo;
    current_phase?: number;
    phase_scores?: Record<string, number>;
    current_phase_started_at?: string;
    is_complete?: boolean;
    total_tokens?: number;
    extra_ai_tokens?: number;
    phase_data?: Record<string, PhaseData>;
    final_output?: FinalOutput;
    current_server_time?: string;
}

export interface StartPhaseRequest {
    session_id: string;
    phase_number: number;
    leaving_phase_number?: number | null;
    leaving_phase_elapsed_seconds?: number | null;
    leaving_phase_responses?: PhaseResponse[] | null;
}

export interface StartPhaseResponse {
    phase_id: string;
    phase_name: string;
    questions: Question[];
    time_limit_seconds: number;
    started_at: string;
    current_server_time?: string;
    previous_responses?: PhaseResponse[];
    elapsed_seconds?: number;  // Accumulated time for pause/resume
}

export interface SubmitPhaseRequest {
    session_id: string;
    phase_name: string;
    responses: PhaseResponse[];
    time_taken_seconds?: number;
}

export interface ScoreBreakdown {
    ai_quality_points: number;
    time_penalty: number;
    retry_penalty: number;
    retries: number;
    hint_penalty: number;
    efficiency_bonus: number;
    phase_weight: number;
    duration_seconds: number;
    tokens_used: number;
    input_tokens?: number;
    output_tokens?: number;
    total_ai_tokens?: number;
}

export interface SubmitPhaseResponse {
    passed: boolean;
    ai_score: number;
    phase_score: number;
    total_score: number;
    feedback: string;
    rationale: string;
    strengths: string[];
    improvements: string[];
    metrics: ScoreBreakdown;
    total_tokens: number;
    extra_ai_tokens: number;
    can_proceed: boolean;
    is_final_phase: boolean;
    history?: PhaseMetrics[];
}

export interface PrepareSynthesisRequest {
    session_id: string;
}

export interface PrepareSynthesisResponse {
    session_id: string;
    master_prompt_draft: string;
}

export interface FinalSynthesisRequest {
    session_id: string;
    edited_prompt: string;
}

export interface FinalSynthesisResponse {
    visionary_hook: string;
    customer_pitch: string;
    image_url: string;
    prompt_used: string;
    total_score: number;
    phase_breakdown: Record<string, number>;
}

export interface LeaderboardEntry {
    rank: number;
    team_id: string;
    score: number;
    usecase: string;
    phases_completed: number;
    total_tokens: number;
    total_retries: number;
    total_duration_seconds: number;
    phase_scores: Record<string, number>;
    is_complete: boolean;
}

export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    total_teams: number;
    updated_at: string;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export type GameView = 'LOBBY' | 'PHASE' | 'FEEDBACK' | 'PROMPT_EDIT' | 'SYNTHESIS' | 'FINAL' | 'LEADERBOARD';

export interface UIState {
    view: GameView;
    loading: boolean;
    error: string | null;
    phaseStartTime: number | null;
    elapsedSeconds: number;
}
