/**
 * Scoring Utilities
 * Shared helper functions for score calculations and display.
 */

export interface ScoreTier {
    label: string;
    className: string;
}

/**
 * Determines the tier label and CSS class for a given score.
 * Thresholds: S=900, A=800, B=700, C=500
 * 
 * @param score - The total score (0-1000)
 * @returns Object with label and className for display
 */
export const getScoreTier = (score: number): ScoreTier => {
    if (score >= 900) {
        return { label: 'S-TIER', className: 'tier-s' };
    }
    if (score >= 800) {
        return { label: 'A-TIER', className: 'tier-a' };
    }
    if (score >= 700) {
        return { label: 'B-TIER', className: 'tier-b' };
    }
    if (score >= 500) {
        return { label: 'C-TIER', className: 'tier-c' };
    }
    return { label: 'D-TIER', className: 'tier-d' };
};

/**
 * Formats time in seconds to MM:SS display format.
 * 
 * @param seconds - Time in seconds
 * @returns Formatted string like "05:30"
 */
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculates the maximum possible score for a phase.
 * 
 * @param phaseWeight - The weight of the phase (0-1)
 * @param maxPoints - Maximum total points (default 1000)
 * @returns Maximum points achievable for this phase
 */
export const getMaxPhaseScore = (phaseWeight: number, maxPoints: number = 1000): number => {
    return Math.round(maxPoints * phaseWeight);
};
