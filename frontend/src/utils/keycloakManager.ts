/**
 * Keycloak Manager
 * Singleton class for managing Keycloak SSO authentication.
 */

import Keycloak from "keycloak-js";

// Constants
const KEYCLOAK_SESSION_KEY = "keycloakSession";
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes in milliseconds
const LOCALHOST_CLIENT_ID = "localhost";
const LOGOUT_REDIRECT_URI = "/";

// Types
interface StoredKeycloakSession {
    token: string;
    refreshToken: string;
    idToken: string;
    timeSkew: number;
    authenticated: boolean;
}

class KeycloakManager {
    private static instance: KeycloakManager;
    private keycloakInstance: Keycloak | null = null;
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private initialized: boolean = false;
    private initPromise: Promise<boolean> | null = null;

    private constructor() { }

    static getInstance(): KeycloakManager {
        if (!KeycloakManager.instance) {
            KeycloakManager.instance = new KeycloakManager();
        }
        return KeycloakManager.instance;
    }

    private getClientId(): string {
        // Always prioritize the environment variable if defined
        const envClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
        if (envClientId) {
            return envClientId;
        }

        if (typeof window === "undefined") {
            return "";
        }

        const host = window.location.host;

        // Special handling for localhost development
        if (host.includes("localhost") || host.includes("127.0.0.1")) {
            return LOCALHOST_CLIENT_ID;
        }

        // Extract the domain parts
        const parts = host.split(".");

        if (parts.length >= 2) {
            // Get the second-to-last part, which should be the main domain name without the TLD
            return parts[parts.length - 2];
        }

        return host;
    }

    private getKeycloakConfig() {
        const url = import.meta.env.VITE_KEYCLOAK_URL || "";
        const realm = import.meta.env.VITE_KEYCLOAK_REALM || "";

        // Basic validation
        if (!url || !realm) {
            console.warn("[Keycloak] Configuration missing! Check VITE_KEYCLOAK_URL and VITE_KEYCLOAK_REALM.");
        }

        return {
            url: url.replace(/\/$/, ''), // Strip trailing slash
            realm: realm,
            clientId: this.getClientId(),
        };
    }

    getKeycloakInstance(): Keycloak {
        if (!this.keycloakInstance) {
            this.keycloakInstance = new Keycloak(this.getKeycloakConfig());
        }
        return this.keycloakInstance;
    }

    async initialize(redirectPath: string = "/login"): Promise<boolean> {
        console.log(`[Keycloak] Initializing (redirectPath: ${redirectPath})`);

        // If already initialized and successful, return true
        if (this.initialized && this.keycloakInstance?.authenticated) {
            console.log("[Keycloak] Already initialized and authenticated");
            return true;
        }

        // If an initialization is already in progress, return its promise
        if (this.initPromise) {
            console.log("[Keycloak] Initialization already in progress, returning existing promise");
            return this.initPromise;
        }

        // Start a new initialization process
        this.initPromise = (async () => {
            try {
                const isBypassAllowed = import.meta.env.VITE_ALLOW_BYPASS === 'true';

                // 1. PRIORITY BYPASS: check this BEFORE any instances
                if (isBypassAllowed && localStorage.getItem('isMockSession') === 'true') {
                    console.log("[Keycloak] 🧪 Mock session active, skipping all Keycloak logic");
                    this.initialized = true;
                    return true;
                } else if (!isBypassAllowed) {
                    localStorage.removeItem('isMockSession');
                }

                const kc = this.getKeycloakInstance();

                // 2. SPEED UP DEV: 2s timeout if bypass allowed, otherwise 10s
                const timeoutMs = isBypassAllowed ? 2000 : 10000;
                console.log(`[Keycloak] Instance created, checking session (timeout: ${timeoutMs}ms)...`);

                // Check if we have a stored session to hydrate
                const sessionData = localStorage.getItem(KEYCLOAK_SESSION_KEY);
                if (sessionData && !this.initialized) {
                    try {
                        const parsed = JSON.parse(sessionData);
                        if (this.isSessionValid(parsed)) {
                            if (!kc.token) {
                                kc.token = parsed.token;
                                kc.refreshToken = parsed.refreshToken;
                                kc.idToken = parsed.idToken;
                                kc.timeSkew = parsed.timeSkew;
                                kc.authenticated = parsed.authenticated;
                            }

                            const initPromise = kc.init({
                                onLoad: 'check-sso',
                                token: parsed.token,
                                refreshToken: parsed.refreshToken,
                                timeSkew: parsed.timeSkew,
                                enableLogging: true,
                                pkceMethod: 'S256',
                                checkLoginIframe: false
                            });

                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error("Keycloak hydration timeout")), timeoutMs)
                            );

                            await Promise.race([initPromise, timeoutPromise]);
                            this.initialized = true;
                            this.startTokenRefresh(kc);
                            return true;
                        }
                    } catch (e) {
                        console.warn("[Keycloak] Hydration failed or timed out", e);
                        this.removeSession();
                    }
                }

                console.log(`[Keycloak] Performing fresh init...`);
                try {
                    const freshInitPromise = kc.init({
                        onLoad: "check-sso",
                        flow: "standard",
                        redirectUri: window.location.origin + redirectPath,
                        pkceMethod: 'S256',
                        checkLoginIframe: false,
                        scope: 'openid profile email'
                    });

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Keycloak timeout")), timeoutMs)
                    );

                    const authenticated = await Promise.race([freshInitPromise, timeoutPromise]) as boolean;

                    console.log(`[Keycloak] Init complete, authenticated: ${authenticated}`);
                    this.initialized = true;
                    if (authenticated) {
                        this.saveSession(kc);
                        this.startTokenRefresh(kc);
                    }
                    return authenticated;
                } catch (err) {
                    if (isBypassAllowed) {
                        console.warn("[Keycloak] Connection failed in Dev Mode. Enabling auto-bypass...");
                        this.setMockSession();
                        return true;
                    }
                    throw err;
                }
            } catch (error) {
                console.error("[Keycloak] Keycloak initialize error:", error);
                // We clear promise so it can be retried, but we don't set initialized=true
                return false;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    async getKeycloakSession(redirectPath: string = "/login"): Promise<Keycloak | null> {
        try {
            const kc = this.getKeycloakInstance();

            if (kc.authenticated) {
                return kc;
            }

            const success = await this.initialize(redirectPath);

            if (!success) {
                // If not authenticated after init, force login
                await kc.login({
                    redirectUri: window.location.origin + redirectPath,
                    scope: 'openid profile email'
                });
                return null;
            }

            return kc;
        } catch (error) {
            console.error("Keycloak getKeycloakSession error:", error);
            return null;
        }
    }

    private startTokenRefresh(kc: Keycloak): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            try {
                await kc.updateToken(30);
                this.updateSession(kc);
            } catch (error) {
                console.error("Token refresh failed:", error);
                this.removeSession();
            }
        }, TOKEN_REFRESH_INTERVAL);
    }

    saveSession(kc: Keycloak): void {
        if (typeof window === "undefined") return;

        const sessionData: StoredKeycloakSession = {
            token: kc.token || "",
            refreshToken: kc.refreshToken || "",
            idToken: kc.idToken || "",
            timeSkew: kc.timeSkew || 0,
            authenticated: kc.authenticated || false,
        };

        localStorage.setItem(KEYCLOAK_SESSION_KEY, JSON.stringify(sessionData));
    }

    removeSession(): void {
        if (typeof window === "undefined") return;

        localStorage.removeItem(KEYCLOAK_SESSION_KEY);
        localStorage.removeItem('isMockSession');

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    updateSession(kc: Keycloak): void {
        if (typeof window === "undefined") return;

        const existingSession = localStorage.getItem(KEYCLOAK_SESSION_KEY);
        if (existingSession) {
            this.saveSession(kc);
        }
    }

    getStoredSession(): Keycloak | null {
        if (typeof window === "undefined") return null;

        const sessionData = localStorage.getItem(KEYCLOAK_SESSION_KEY);
        if (!sessionData) return null;

        try {
            const parsedSession: StoredKeycloakSession = JSON.parse(sessionData);

            if (!this.isSessionValid(parsedSession)) {
                this.removeSession();
                return null;
            }

            const kc = this.getKeycloakInstance();
            kc.token = parsedSession.token;
            kc.refreshToken = parsedSession.refreshToken;
            kc.idToken = parsedSession.idToken;
            kc.timeSkew = parsedSession.timeSkew;
            kc.authenticated = parsedSession.authenticated;

            return kc;
        } catch (error) {
            console.error("Error parsing stored session:", error);
            this.removeSession();
            return null;
        }
    }

    private isSessionValid(session: StoredKeycloakSession): boolean {
        if (!session.token) return false;

        try {
            const tokenPayload = JSON.parse(atob(session.token.split(".")[1]));
            const tokenExpiration = tokenPayload.exp;

            if (tokenExpiration) {
                const currentTime = Math.floor(Date.now() / 1000);
                return tokenExpiration > currentTime;
            }
        } catch (error) {
            console.error("Error validating token:", error);
        }

        return false;
    }

    async logout(): Promise<void> {
        // Handle mock session logout
        if (localStorage.getItem('isMockSession') === 'true') {
            this.removeSession();
            return;
        }

        const kc = await this.getKeycloakSession("/logout");
        if (kc === null) {
            this.removeSession();
            return;
        }

        try {
            await kc.logout({
                redirectUri: window.location.origin + LOGOUT_REDIRECT_URI,
            });
            this.removeSession();
        } catch (error) {
            console.error("Keycloak logout error:", error);
        }
    }

    async getKeycloakProfile(): Promise<string> {
        if (localStorage.getItem('isMockSession') === 'true') {
            return "dev-user@example.com";
        }

        const kc = await this.getKeycloakSession();
        if (!kc) {
            throw new Error("Keycloak session not initialized");
        }

        try {
            const profile = await kc.loadUserProfile();
            return profile.email || "";
        } catch (error) {
            console.error("Error loading Keycloak user profile:", error);
            throw error;
        }
    }

    getToken(): string | null {
        if (localStorage.getItem('isMockSession') === 'true') {
            return "mock-dev-token";
        }
        const kc = this.getKeycloakInstance();
        return kc.token || null;
    }

    isAuthenticated(): boolean {
        if (localStorage.getItem('isMockSession') === 'true') {
            return true;
        }
        const kc = this.getKeycloakInstance();
        return kc.authenticated || false;
    }

    setMockSession(): void {
        localStorage.setItem('isMockSession', 'true');
        this.initialized = true;

        // Populate the instance with mock data so AuthProvider is happy
        const kc = this.getKeycloakInstance();
        kc.authenticated = true;
        kc.token = "mock-dev-token";
        (kc as any).idTokenParsed = {
            email: "dev-user@example.com",
            name: "Dev User",
            preferred_username: "devuser",
            sub: "mock-sub-123"
        };
    }
}

// Export singleton instance
export const keycloakManager = KeycloakManager.getInstance();

// Export convenience functions
export const logout = () => keycloakManager.logout();
export const getToken = () => keycloakManager.getToken();
export const isAuthenticated = () => keycloakManager.isAuthenticated();
