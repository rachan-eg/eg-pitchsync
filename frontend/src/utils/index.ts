/**
 * Frontend Utilities
 * Re-exports all utility functions for convenient imports.
 */

export { getApiUrl, getFullUrl } from './api';
export { getScoreTier, formatTime, getMaxPhaseScore } from './scoring';
export type { ScoreTier } from './scoring';
export { keycloakManager, logout, getToken, isAuthenticated } from './keycloakManager';

// Resilient API utilities
export {
    resilientFetch,
    apiGet,
    apiPost,
    apiPostForm,
    checkHealth
} from './resilientApi';
export type { ApiError, ApiResponse, HealthStatus } from './resilientApi';

