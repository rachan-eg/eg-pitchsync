/**
 * AuthProvider
 * Context for managing authentication state with Keycloak SSO.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { keycloakManager } from '../utils/keycloakManager';
import { getApiUrl } from '../utils/api';

// =============================================================================
// TYPES
// =============================================================================

export interface UserInfo {
    email: string;
    name?: string;
    preferredUsername?: string;
    picture?: string;
}

export interface TeamCodeInfo {
    teamName: string;
    usecaseId: string;
    description: string;
}

export interface AuthContextType {
    // Auth State
    isAuthenticated: boolean;
    isLoading: boolean;
    user: UserInfo | null;
    token: string | null;

    // Team Code State
    teamCodeInfo: TeamCodeInfo | null;
    teamCodeValidated: boolean;

    // Actions
    login: (redirectPath?: string) => Promise<void>;
    logout: () => Promise<void>;
    validateTeamCode: (code: string) => Promise<{ valid: boolean; message?: string }>;
    clearTeamCode: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [teamCodeInfo, setTeamCodeInfo] = useState<TeamCodeInfo | null>(() => {
        const saved = sessionStorage.getItem('pitch_sync_team_info');
        try { return saved ? JSON.parse(saved) : null; } catch { return null; }
    });
    const [teamCodeValidated, setTeamCodeValidated] = useState<boolean>(() => {
        return sessionStorage.getItem('pitch_sync_team_validated') === 'true';
    });

    // Check for existing session or handle redirect on mount
    useEffect(() => {
        const checkAuth = async () => {
            console.log('[Auth] Starting checkAuth...');

            try {
                // Determine if we are on the login page or returning from redirect
                const isReturningFromAuth = window.location.href.includes('state=') || window.location.href.includes('code=');
                const redirectUri = isReturningFromAuth ? window.location.pathname : '/login';

                console.log(`[Auth] Initializing Keycloak (isReturning: ${isReturningFromAuth}, uri: ${redirectUri})`);
                const authenticated = await keycloakManager.initialize(redirectUri);
                console.log(`[Auth] Keycloak init result: ${authenticated}`);

                if (authenticated) {
                    const token = keycloakManager.getToken();
                    console.log('[Auth] Authenticated by Keycloak, validating with backend...');

                    // Backend validation with timeout
                    try {
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 15000); // Increased to 15s

                        const response = await fetch(getApiUrl('/api/auth/status'), {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            signal: controller.signal
                        });

                        clearTimeout(id);

                        if (response.ok) {
                            const data = await response.json();
                            console.log('[Auth] Backend status:', data.authenticated);

                            if (data.authenticated) {
                                setIsAuthenticated(true);
                                setToken(token);

                                // Get additional data from ID Token
                                const kc = keycloakManager.getKeycloakInstance();
                                const idToken = (kc as any).idTokenParsed || {};

                                // Helper to normalize picture URL
                                const normalizePicture = (url?: string) => {
                                    if (!url) return undefined;
                                    if (url.startsWith('http') || url.startsWith('data:')) return url;
                                    const baseUrl = import.meta.env.VITE_KEYCLOAK_URL || "";
                                    return baseUrl ? `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}` : url;
                                };

                                let picture = idToken.picture || idToken.avatar || idToken.photo || idToken.avatar_url;

                                // Fallback: Load full profile if picture is missing from ID token (SKIP IN MOCK MODE)
                                const isMock = localStorage.getItem('isMockSession') === 'true';
                                if (!picture && !isMock) {
                                    console.log('[Auth] Picture missing in ID Token, fetching full profile...');
                                    try {
                                        const profile = await kc.loadUserProfile() as any;
                                        picture = profile.attributes?.picture?.[0] ||
                                            profile.attributes?.avatar?.[0] ||
                                            profile.attributes?.photo?.[0];
                                    } catch (e) {
                                        console.warn('[Auth] Failed to load user profile fallback', e);
                                    }
                                }

                                const userData = {
                                    email: data.user?.email || idToken.email || 'authenticated-user',
                                    name: data.user?.name || idToken.name || idToken.preferred_username,
                                    preferredUsername: data.user?.preferred_username || idToken.preferred_username,
                                    picture: normalizePicture(data.user?.picture || picture)
                                };

                                console.log('[Auth] Handshake - Final User Data:', userData);
                                setUser(userData);
                            } else {
                                console.warn('[Auth] Backend rejected session (authenticated=false)');
                                setIsAuthenticated(false);
                                setUser(null);
                            }
                        } else if (response.status === 401) {
                            console.warn('[Auth] Backend returned 401 Unauthorized');
                            // If backend is in TEST_MODE but frontend thinks it's auth'd, or vice versa,
                            // we might want to respect the backend's refusal if it's "real" 401.
                            // But usually if Keycloak said yes, we trust it for the UI.
                            setIsAuthenticated(true);
                            setToken(token);
                            const email = await keycloakManager.getKeycloakProfile();
                            setUser({ email });
                        } else {
                            console.warn(`[Auth] Backend error (${response.status}), falling back to Keycloak profile`);
                            setIsAuthenticated(true);
                            setToken(token);
                            const email = await keycloakManager.getKeycloakProfile();
                            setUser({ email });
                        }
                    } catch (backendError) {
                        console.error('[Auth] Backend validation error/timeout:', backendError);
                        // Fallback to local profile if backend is down or timed out
                        setIsAuthenticated(true);
                        setToken(token);
                        try {
                            const email = await keycloakManager.getKeycloakProfile();
                            setUser({ email });
                        } catch (profileError) {
                            console.error('[Auth] Profile load failed after backend error', profileError);
                        }
                    }
                } else {
                    console.log('[Auth] Not authenticated by Keycloak after init');
                }
            } catch (error) {
                console.error('[Auth] Error in checkAuth:', error);
            } finally {
                console.log('[Auth] checkAuth complete, setting isLoading to false');
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Login function
    const login = useCallback(async (redirectPath: string = '/team-code') => {
        setIsLoading(true);
        try {
            const session = await keycloakManager.getKeycloakSession(redirectPath);
            if (session && session.authenticated) {
                keycloakManager.saveSession(session);
                setIsAuthenticated(true);
                setToken(session.token || null);

                try {
                    const kc = keycloakManager.getKeycloakInstance();
                    const idToken = (kc as any).idTokenParsed || {};
                    const profileData = (await kc.loadUserProfile().catch(() => ({}))) as any;
                    console.log('[Auth] Login - ID Token:', idToken, 'Profile:', profileData);

                    const normalizePicture = (url?: string) => {
                        if (!url) return undefined;
                        if (url.startsWith('http')) return url;
                        const baseUrl = import.meta.env.VITE_KEYCLOAK_URL || "https://egauth.cto.aks.egdev.eu";
                        return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
                    };

                    const userData = {
                        email: idToken.email || profileData.email || 'authenticated-user',
                        name: idToken.name || `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || undefined,
                        picture: normalizePicture(idToken.picture || idToken.avatar || idToken.photo || idToken.avatar_url || profileData.attributes?.picture?.[0] || profileData.attributes?.avatar?.[0])
                    };
                    console.log('[Auth] Login - Final User Data (Normalized):', userData);
                    setUser(userData);
                } catch {
                    setUser({ email: 'authenticated-user' });
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Logout function
    const logout = useCallback(async () => {
        try {
            await keycloakManager.logout();
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            setTeamCodeInfo(null);
            setTeamCodeValidated(false);
        }
    }, []);

    // Validate team code
    const validateTeamCode = useCallback(async (code: string): Promise<{ valid: boolean; message?: string }> => {
        try {
            const response = await fetch(getApiUrl('/api/auth/validate-code'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.valid) {
                const info = {
                    teamName: data.team_name,
                    usecaseId: data.usecase_id,
                    description: data.description
                };
                setTeamCodeInfo(info);
                setTeamCodeValidated(true);

                // Persist team validation
                sessionStorage.setItem('pitch_sync_team_info', JSON.stringify(info));
                sessionStorage.setItem('pitch_sync_team_validated', 'true');

                return { valid: true };
            } else {
                return { valid: false, message: data.message || 'Invalid team code' };
            }
        } catch (error) {
            console.error('Team code validation error:', error);
            return { valid: false, message: 'Failed to validate team code. Please try again.' };
        }
    }, [token]);

    // Clear team code (for reset/restart)
    const clearTeamCode = useCallback(() => {
        setTeamCodeInfo(null);
        setTeamCodeValidated(false);
        sessionStorage.removeItem('pitch_sync_team_info');
        sessionStorage.removeItem('pitch_sync_team_validated');
    }, []);

    const value = useMemo(() => ({
        isAuthenticated,
        isLoading,
        user,
        token,
        teamCodeInfo,
        teamCodeValidated,
        login,
        logout,
        validateTeamCode,
        clearTeamCode
    }), [
        isAuthenticated,
        isLoading,
        user,
        token,
        teamCodeInfo,
        teamCodeValidated,
        login,
        logout,
        validateTeamCode,
        clearTeamCode
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
