import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
import { useAuth } from './providers';

// Components (loaded immediately - used across the app)
import { GlobalHeader } from './components/GlobalHeader/GlobalHeader';
import { ErrorModal } from './components/ErrorModal/ErrorModal';
import { PhaseFeedback } from './components/PhaseFeedback/PhaseFeedback';
import { PhaseInput } from './components/PhaseInput/PhaseInput';
import { AuthLoading } from './components/AuthLoading/AuthLoading';
import { TacticalLoader } from './components/TacticalLoader';
import { MouseGlowEffect } from './components/MouseGlowEffect';
import { BroadcastReceiver } from './components/BroadcastReceiver/BroadcastReceiver';

// =============================================================================
// LAZY LOADED PAGES (Code Splitting for Performance)
// =============================================================================
// Critical path pages - loaded immediately
import { Login } from './pages/Login/Login';
import { TeamCode } from './pages/TeamCode/TeamCode';

// Game pages - lazy loaded on demand
const MissionBrief = lazy(() => import('./pages/MissionBrief/MissionBrief').then(m => ({ default: m.MissionBrief })));
const WarRoom = lazy(() => import('./pages/WarRoom/WarRoom').then(m => ({ default: m.WarRoom })));
const PromptCuration = lazy(() => import('./pages/PromptCuration/PromptCuration').then(m => ({ default: m.PromptCuration })));
const FinalReveal = lazy(() => import('./pages/FinalReveal/FinalReveal').then(m => ({ default: m.FinalReveal })));
const PresentationMode = lazy(() => import('./pages/PresentationMode/PresentationMode').then(m => ({ default: m.PresentationMode })));
const Leaderboard = lazy(() => import('./pages/Leaderboard/Leaderboard').then(m => ({ default: m.Leaderboard })));

// Admin page - lazy loaded (only needed by admins)
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Lazy loading fallback component
const LazyFallback = () => <TacticalLoader message="Loading Module" subMessage="Preparing interface..." />;



// =============================================================================
// PROTECTED ROUTE WRAPPER
// =============================================================================

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    requireTeamCode?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAuth = true,
    requireTeamCode = false
}) => {
    const { isAuthenticated, isLoading, teamCodeValidated } = useAuth();

    if (isLoading) {
        return <AuthLoading message="Validating Secure Connection" />;
    }

    if (requireAuth && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requireTeamCode && !teamCodeValidated) {
        return <Navigate to="/team-code" replace />;
    }

    return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return <AuthLoading message="Validating Command Access" />;
    }

    if (!isAdmin) {
        return <Navigate to="/team-code" replace />;
    }

    return <>{children}</>;
};

// =============================================================================
// PAGE WRAPPERS (Connect pages to context and routing)
// =============================================================================

const MissionBriefPage: React.FC = () => {
    const { session, phaseConfig, initSessionFromTeamCode } = useApp();
    const { teamCodeInfo, clearTeamCode } = useAuth();
    const navigate = useNavigate();
    const [isInitializing, setIsInitializing] = React.useState(false);
    const [initError, setInitError] = React.useState<string | null>(null);
    const initAttemptedRef = React.useRef(false);

    // Initialize session from team code info if we don't have a session yet
    // OR if the current session is from a different team (e.g., stale data)
    React.useEffect(() => {
        const initFromTeamCode = async () => {
            // Check if we need to initialize: either no session, or session team mismatch
            const needsInit = !session || (teamCodeInfo && session.team_id !== teamCodeInfo.teamName);

            if (needsInit && teamCodeInfo && !isInitializing) {
                if (initAttemptedRef.current) return;
                initAttemptedRef.current = true;

                if (session && session.team_id !== teamCodeInfo.teamName) {
                    console.log(`🔄 Session team mismatch in MissionBriefPage: "${session.team_id}" vs "${teamCodeInfo.teamName}". Re-initializing...`);
                }

                setIsInitializing(true);
                setInitError(null);

                try {
                    const result = await initSessionFromTeamCode(
                        teamCodeInfo.teamName,
                        teamCodeInfo.usecaseId
                    );

                    if (!result.success) {
                        setInitError('Failed to initialize session. Please try again.');
                        initAttemptedRef.current = false; // Allow retry
                    }
                } catch (err) {
                    setInitError('An error occurred while starting your session.');
                    initAttemptedRef.current = false; // Allow retry
                } finally {
                    setIsInitializing(false);
                }
            }
        };

        initFromTeamCode();
    }, [session, teamCodeInfo, isInitializing, initSessionFromTeamCode]);

    // Show loading while initializing or if team mismatch detected
    const isTeamMismatch = session && teamCodeInfo && session.team_id !== teamCodeInfo.teamName;
    if (isInitializing || (!session && teamCodeInfo) || isTeamMismatch) {
        return <TacticalLoader message="Preparing Mission" subMessage="Establishing secure uplink with command center..." />;
    }

    // Show error if initialization failed
    if (initError) {
        return (
            <div className="flex items-center justify-center h-screen flex-col gap-4">
                <p className="text-red-400">{initError}</p>
                <button
                    className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
                    onClick={() => {
                        clearTeamCode();
                        navigate('/team-code', { replace: true });
                    }}
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!session) {
        return <TacticalLoader message="Syncing Strategy" subMessage="Loading team configuration..." />;
    }

    return (
        <MissionBrief
            usecase={session.usecase}
            theme={session.theme_palette}
            phases={phaseConfig}
        />
    );
};

const WarRoomPage: React.FC = () => {
    const {
        session,
        phaseConfig,
        highestUnlockedPhase,
        currentPhaseResponses,
        loading
    } = useApp();
    if (!session) {
        return <TacticalLoader message="War Room" subMessage="Recalibrating tactical interface..." />;
    }

    const currentPhase = phaseConfig[session.current_phase];
    if (!currentPhase) {
        return <div>Phase Not Found</div>;
    }

    return (
        <WarRoom
            session={session}
            phaseConfig={phaseConfig}
            highestUnlockedPhase={highestUnlockedPhase}
        >
            <PhaseInput
                phase={currentPhase}
                phaseNumber={session.current_phase}
                totalPhases={Object.keys(phaseConfig).length}
                timeLimit={currentPhase.time_limit_seconds}
                isSubmitting={loading}
                initialResponses={currentPhaseResponses}
            />
        </WarRoom>
    );
};

const PromptCurationPage: React.FC = () => {
    const { session, curatedPrompt, loading } = useApp();

    if (!session) {
        return <TacticalLoader message="Vision Curation" subMessage="Accessing strategic assets..." />;
    }

    return (
        <PromptCuration
            session={session}
            curatedPrompt={curatedPrompt}
            usecaseTitle={session.usecase.title}
            theme={session.theme_palette}
            totalScore={session.total_score}
            isLoading={loading}
        />
    );
};

import { getFullUrl } from './utils';

const FinalRevealPage: React.FC = () => {
    const { session, activeRevealSubmission } = useApp();

    if (!session) {
        return <TacticalLoader message="Final Reveal" subMessage="Preparing briefing finalization..." />;
    }

    // Determine the best image URL to show (current selection OR session default)
    const effectiveImageUrl = activeRevealSubmission?.image_url || (session.final_output?.image_url ? getFullUrl(session.final_output.image_url) : '');

    return (
        <FinalReveal
            session={session}
            imageUrl={effectiveImageUrl}
            selectedSubmission={activeRevealSubmission}
        />
    );
};

const PresentationModePage: React.FC = () => {
    const { session, activeRevealSubmission } = useApp();

    if (!session) {
        return <TacticalLoader message="Presentation" subMessage="Synchronizing presentation deck..." />;
    }

    // Determine the best image URL to show (current selection OR session default)
    const effectiveImageUrl = activeRevealSubmission?.image_url
        ? getFullUrl(activeRevealSubmission.image_url)
        : (session.final_output?.image_url ? getFullUrl(session.final_output.image_url) : '');

    return (
        <PresentationMode
            session={session}
            imageUrl={effectiveImageUrl}
        />
    );
};

const LeaderboardPage: React.FC = () => {
    const { leaderboard, session } = useApp();

    return (
        <Leaderboard
            entries={leaderboard}
            currentTeamId={session?.team_id}
        />
    );
};

// =============================================================================
// LAYOUT WITH HEADER (for game pages)
// =============================================================================
const GameLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        session,
        phaseResult,
        setPhaseResult,
        error,
        setError,
        handleFeedbackAction
    } = useApp();

    // Handle feedback actions with navigation
    const onFeedbackContinue = async () => {
        if (phaseResult?.is_final_phase) {
            // Navigate immediately to show the curation page's loading state
            navigate('/curate');
            await handleFeedbackAction('CONTINUE');
        } else {
            await handleFeedbackAction('CONTINUE');
            // Stay on war-room, just next phase
        }
    };

    const onFeedbackRetry = async () => {
        await handleFeedbackAction('RETRY');
        // Stay on war-room
    };

    // War room needs absolute no scroll on the outer container
    const isWarRoom = location.pathname === '/war-room';


    return (
        <div className="flex flex-col relative h-full w-full">
            {/* Global Header */}
            <GlobalHeader
                session={session}
            />

            {/* Main Content Area - wrapped in Suspense for lazy loading */}
            <main
                className={`flex-1 min-h-0 flex flex-col ${isWarRoom ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}
            >
                <Suspense fallback={<LazyFallback />}>
                    <Routes>
                        <Route path="/mission" element={<MissionBriefPage />} />
                        <Route path="/war-room" element={<WarRoomPage />} />
                        <Route path="/curate" element={<PromptCurationPage />} />
                        <Route path="/reveal" element={<FinalRevealPage />} />
                        <Route path="/present" element={<PresentationModePage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="*" element={<Navigate to="/mission" replace />} />
                    </Routes>
                </Suspense>
            </main>

            {/* Phase Feedback Modal */}
            {phaseResult && (
                <PhaseFeedback
                    result={phaseResult}
                    onContinue={onFeedbackContinue}
                    onRetry={onFeedbackRetry}
                    onClose={() => setPhaseResult(null)}
                />
            )}

            {/* Error Modal */}
            {error && location.pathname !== '/team-code' && (
                <ErrorModal
                    message={error}
                    onCallback={() => setError(null)}
                />
            )}
        </div>
    );
};

// =============================================================================
// MAIN APP
// =============================================================================
const App: React.FC = () => {
    const { isAuthenticated, teamCodeValidated } = useAuth();

    return (
        <>
            {/* Global mouse tracking for reactive borders */}
            <MouseGlowEffect />
            <BroadcastReceiver />

            <Routes>
                {/* Public Routes */}
                <Route
                    path="/login"
                    element={
                        isAuthenticated ? <Navigate to="/team-code" replace /> : <Login />
                    }
                />

                {/* Team Code Route (requires auth) */}
                <Route
                    path="/team-code"
                    element={
                        <ProtectedRoute requireAuth={true}>
                            {teamCodeValidated ? <Navigate to="/mission" replace /> : <TeamCode />}
                        </ProtectedRoute>
                    }
                />

                {/* Admin Route - lazy loaded with Suspense */}
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <Suspense fallback={<LazyFallback />}>
                                <AdminDashboard />
                            </Suspense>
                        </AdminRoute>
                    }
                />

                {/* Game Routes (requires auth + team code) */}
                <Route
                    path="/*"
                    element={
                        <ProtectedRoute requireAuth={true} requireTeamCode={true}>
                            <AppProvider>
                                <GameLayout />
                            </AppProvider>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </>
    );
};

export default App;

