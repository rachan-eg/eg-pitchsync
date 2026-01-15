/**
 * AppContext (Refactored / Legacy Bridge)
 * 
 * This file serves as a bridge for the newly decomposed providers.
 * Components can still use `useApp()`, which now aggregates state from:
 * - SessionProvider (Core session & phases)
 * - TimerProvider (Timing)
 * - UIProvider (Loading, errors, leaderboard)
 * 
 * New code should prefer using the specialized hooks directly.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useSession, useTimer, useUI } from './providers';
import type {
    UseCase, Theme, SessionState, PhaseDefinition, ScoringInfo,
    SubmitPhaseResponse, PhaseResponse, LeaderboardEntry
} from './types';

// =============================================================================
// CONTEXT TYPES
// =============================================================================
export interface AppContextType {
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
// BRIDGE PROVIDER
// =============================================================================
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const sessionContext = useSession();
    const timerContext = useTimer();
    const uiContext = useUI();

    // Map all decomposed states into the legacy context structure
    const value = useMemo(() => ({
        ...sessionContext,
        ...uiContext,
        elapsedSeconds: timerContext.elapsedSeconds,
        resumeTimer: timerContext.resumeTimer
    }), [sessionContext, uiContext, timerContext]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
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
