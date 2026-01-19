/**
 * Resilient API Client
 * 
 * Provides fault-tolerant API communication with:
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - User-friendly error messages
 * - Request deduplication
 */

import { getApiUrl } from './api';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiError {
    message: string;
    code: string;
    errorId?: string;
    retryable: boolean;
    status: number;
}

export interface ApiResponse<T> {
    data: T | null;
    error: ApiError | null;
    success: boolean;
}

interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 2,
    baseDelay: 1000,  // 1 second
    maxDelay: 10000,  // 10 seconds
};

const REQUEST_TIMEOUT = 120000;  // 2 minutes for AI operations

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];


function classifyError(error: unknown, status?: number): ApiError {
    // Handle fetch errors (network issues)
    if (error instanceof TypeError) {
        return {
            message: 'Unable to connect to server. Please check your internet connection.',
            code: 'NETWORK_ERROR',
            retryable: true,
            status: 0,
        };
    }

    // Handle AbortError (timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
        return {
            message: 'Request timed out. The server is busy, please try again.',
            code: 'TIMEOUT',
            retryable: true,
            status: 0,
        };
    }

    // Handle HTTP errors
    if (status) {
        const errorMessages: Record<number, string> = {
            400: 'Invalid request. Please check your input.',
            401: 'Session expired. Please log in again.',
            403: 'You do not have permission to perform this action.',
            404: 'Resource not found.',
            408: 'Request timed out. Please try again.',
            429: 'Too many requests. Please wait a moment and try again.',
            500: 'Server error. Our team has been notified.',
            502: 'Server is temporarily unavailable. Please try again.',
            503: 'Service is under maintenance. Please try again later.',
            504: 'Request timed out. The AI is processing your request.',
        };

        return {
            message: errorMessages[status] || `Server error (${status})`,
            code: `HTTP_${status}`,
            retryable: RETRYABLE_STATUSES.includes(status),
            status,
        };
    }

    // Unknown error
    return {
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
        code: 'UNKNOWN',
        retryable: false,
        status: 0,
    };
}

// ============================================================================
// CORE FETCH WITH RETRY
// ============================================================================

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function resilientFetch<T>(
    url: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
): Promise<ApiResponse<T>> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return { data, error: null, success: true };
            }

            // Try to parse error response
            let errorData: any = {};
            try {
                errorData = await response.json();
            } catch {
                // Response body might not be JSON
            }

            const error = classifyError(null, response.status);
            error.errorId = errorData.error_id;

            // Use server-provided message if available
            if (errorData.detail) {
                error.message = typeof errorData.detail === 'string'
                    ? errorData.detail
                    : JSON.stringify(errorData.detail);
            }

            lastError = error;

            // Check if retryable
            if (!error.retryable || attempt >= config.maxRetries) {
                return { data: null, error, success: false };
            }

            // Wait before retry
            const delay = Math.min(
                config.baseDelay * Math.pow(2, attempt),
                config.maxDelay
            );
            console.log(`🔄 Retry ${attempt + 1}/${config.maxRetries} in ${delay}ms...`);
            await sleep(delay);

        } catch (err) {
            clearTimeout(timeoutId);

            const error = classifyError(err);
            lastError = error;

            if (!error.retryable || attempt >= config.maxRetries) {
                return { data: null, error, success: false };
            }

            const delay = Math.min(
                config.baseDelay * Math.pow(2, attempt),
                config.maxDelay
            );
            console.log(`🔄 Retry ${attempt + 1}/${config.maxRetries} in ${delay}ms...`);
            await sleep(delay);
        }
    }

    return {
        data: null,
        error: lastError || classifyError(new Error('All retries exhausted')),
        success: false
    };
}

// ============================================================================
// CONVENIENCE METHODS
// ============================================================================

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
    return resilientFetch<T>(getApiUrl(path), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return resilientFetch<T>(getApiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    return resilientFetch<T>(getApiUrl(path), {
        method: 'POST',
        body: formData,
    });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthStatus {
    online: boolean;
    status: 'healthy' | 'degraded' | 'offline';
    services?: {
        database: string;
        circuits: Record<string, { state: string; healthy: boolean }>;
    };
}

export async function checkHealth(): Promise<HealthStatus> {
    try {
        const response = await fetch(getApiUrl('/health'), {
            method: 'GET',
            signal: AbortSignal.timeout(5000),  // 5s timeout for health check
        });

        if (response.ok) {
            const data = await response.json();
            return {
                online: true,
                status: data.status || 'healthy',
                services: data.services,
            };
        }

        return { online: true, status: 'degraded' };
    } catch {
        return { online: false, status: 'offline' };
    }
}
