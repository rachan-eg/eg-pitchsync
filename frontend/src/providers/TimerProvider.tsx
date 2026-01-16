/**
 * Timer Provider
 * Centralized timer management for phase timing with pause/resume support.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// =============================================================================
// TIMER STATE TYPES
// =============================================================================
type TimerState = 'STOPPED' | 'RUNNING' | 'PAUSED';

interface TimerContextType {
    timerState: TimerState;
    elapsedSeconds: number;
    startTimer: (baseSeconds?: number) => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: (finalSeconds?: number) => void;
    resetTimer: () => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

// =============================================================================
// TIMER PROVIDER
// =============================================================================
export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [timerState, setTimerState] = useState<TimerState>('STOPPED');
    const [timerBaseSeconds, setTimerBaseSeconds] = useState(0);
    const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Start timer from a given base (accumulated) seconds
    const startTimer = useCallback((baseSeconds: number = 0) => {
        console.log(`[Timer] startTimer called with base: ${baseSeconds}s`);
        setTimerBaseSeconds(baseSeconds);
        setTimerStartedAt(Date.now());
        setElapsedSeconds(baseSeconds);
        setTimerState('RUNNING');
    }, []);

    // Pause timer and save current progress to base
    const pauseTimer = useCallback(() => {
        if (timerState === 'RUNNING' && timerStartedAt) {
            const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
            const total = timerBaseSeconds + currentRun;
            console.log(`[Timer] pausing at ${total}s (${currentRun}s in current run)`);
            setTimerBaseSeconds(total);
            setElapsedSeconds(total); // Update UI immediately
            setTimerStartedAt(null);
        }
        setTimerState('PAUSED');
    }, [timerState, timerStartedAt, timerBaseSeconds]);

    // Resume from paused state
    const resumeTimer = useCallback(() => {
        if (timerState === 'PAUSED') {
            console.log('[Timer] resuming from pause');
            setTimerStartedAt(Date.now());
            setTimerState('RUNNING');
        }
    }, [timerState]);

    // Stop timer completely (optionally set final value)
    const stopTimer = useCallback((finalSeconds?: number) => {
        let total = timerBaseSeconds;
        if (finalSeconds !== undefined) {
            total = finalSeconds;
        } else if (timerStartedAt) {
            const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
            total = timerBaseSeconds + currentRun;
        }

        console.log(`[Timer] stopping at ${total}s`);
        setElapsedSeconds(total);
        setTimerBaseSeconds(total);
        setTimerStartedAt(null);
        setTimerState('STOPPED');
    }, [timerStartedAt, timerBaseSeconds]);

    // Reset timer to zero
    const resetTimer = useCallback(() => {
        setTimerBaseSeconds(0);
        setTimerStartedAt(null);
        setElapsedSeconds(0);
        setTimerState('STOPPED');
    }, []);

    // Timer tick effect with visibility handling
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        const updateElapsed = () => {
            if (timerStartedAt) {
                const currentRun = Math.floor((Date.now() - timerStartedAt) / 1000);
                setElapsedSeconds(timerBaseSeconds + currentRun);
            }
        };

        // Handle visibility change - immediately update when tab becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && timerState === 'RUNNING') {
                updateElapsed();
            }
        };

        if (timerState === 'RUNNING' && timerStartedAt) {
            // Initial update
            updateElapsed();
            // Regular interval
            interval = setInterval(updateElapsed, 1000);
            // Visibility listener
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [timerState, timerStartedAt, timerBaseSeconds]);

    return (
        <TimerContext.Provider value={{
            timerState,
            elapsedSeconds,
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            resetTimer
        }}>
            {children}
        </TimerContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================
export const useTimer = (): TimerContextType => {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
};
