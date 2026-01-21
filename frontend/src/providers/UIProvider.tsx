/**
 * UI Provider
 * Manages UI-level state like loading, errors, and leaderboard visibility.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getApiUrl } from '../utils';
import type { LeaderboardEntry, LeaderboardResponse } from '../types';

// =============================================================================
// UI CONTEXT TYPES
// =============================================================================
interface UIContextType {
    // Loading & Error State
    loading: boolean;
    setLoading: (loading: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;

    // Leaderboard
    leaderboard: LeaderboardEntry[];
    showLeaderboard: boolean;
    setShowLeaderboard: (show: boolean) => void;
    fetchLeaderboard: () => Promise<void>;
}

const UIContext = createContext<UIContextType | null>(null);

// =============================================================================
// UI PROVIDER
// =============================================================================
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loading, setLoadingState] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const loadingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Safety timeout: Reset loading after 90 seconds to prevent infinite loops
    const MAX_LOADING_TIME = 90000; // 90 seconds

    const setLoading = useCallback((isLoading: boolean) => {
        // Clear any existing timeout
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }

        setLoadingState(isLoading);

        // Set safety timeout when loading starts
        if (isLoading) {
            loadingTimeoutRef.current = setTimeout(() => {
                console.warn('⚠️ Loading state safety timeout triggered after 90s');
                setLoadingState(false);
                setError('Operation timed out. Please try again or refresh the page.');
            }, MAX_LOADING_TIME);
        }
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, []);

    // Fetch leaderboard data
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

    // Auto-refresh leaderboard every 30 seconds
    useEffect(() => {
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [fetchLeaderboard]);

    return (
        <UIContext.Provider value={{
            loading,
            setLoading,
            error,
            setError,
            leaderboard,
            showLeaderboard,
            setShowLeaderboard,
            fetchLeaderboard
        }}>
            {children}
        </UIContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================
export const useUI = (): UIContextType => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
