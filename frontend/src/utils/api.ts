/**
 * API Utilities
 * Shared helper functions for API communication.
 */

/**
 * Constructs the full API URL from a relative path.
 * Handles various base URL configurations (development, production, relative paths).
 * 
 * @param path - The API endpoint path (e.g., '/api/init')
 * @returns The complete URL to call
 */
export const getApiUrl = (path: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Handle case where base already ends with /api and path starts with /api
    if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api')) {
        return `${cleanBase}${cleanPath.substring(4)}`;
    }

    // Handle relative base URL in production (e.g., '/api')
    if ((cleanBase === '' || cleanBase === '/') && cleanPath.startsWith('/api')) {
        return cleanPath;
    }

    return `${cleanBase}${cleanPath}`;
};

/**
 * Constructs the full URL for static assets (images, etc.)
 * 
 * @param path - The asset path (e.g., '/generated/image.png')
 * @returns The complete URL to the asset
 */
export const getFullUrl = (path: string): string => {
    if (!path) return '';

    // Normalize path by removing duplicates and fixing common prefixes
    let normalizedPath = path;

    // 1. If absolute URL, extract the path part for normalization
    if (path.startsWith('http')) {
        try {
            const url = new URL(path);
            normalizedPath = url.pathname;
        } catch (e) {
            // Fallback for malformed URLs
            normalizedPath = path.split('/').slice(3).join('/');
            if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
        }
    }

    // 2. Data URLs are returned as-is
    if (path.startsWith('data:')) return path;

    // 3. Ensure path starts with a single slash
    if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;

    // 4. Remove /api/api or /api prefix from static assets
    // We want /generated/... not /api/generated/...
    if (normalizedPath.startsWith('/api/api/')) {
        normalizedPath = normalizedPath.substring(4);
    }

    if (normalizedPath.startsWith('/api/generated/')) {
        normalizedPath = normalizedPath.substring(4);
    }

    // 5. Special handling for static vs backend assets
    const isGeneratedAsset = normalizedPath.startsWith('/generated/');
    const isVaultAsset = normalizedPath.startsWith('/vault/');
    const isLocalStatic = normalizedPath.startsWith('/assets/');

    if (isLocalStatic) {
        // Local frontend assets (logos, UI icons) remain root-relative
        return normalizedPath;
    }

    if (isGeneratedAsset || isVaultAsset) {
        // Assets are handled via root-relative paths in both dev (Vite proxy) and prod (Nginx)
        return normalizedPath;
    }

    // 6. For API requests, use the base URL if configured
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // If base is /api and path already has /api, don't double it
    if (cleanBase === '/api' && normalizedPath.startsWith('/api/')) {
        return normalizedPath;
    }

    return `${cleanBase}${normalizedPath}`;
};
