import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
import { useAuth } from './providers';

// Pages
import { Login } from './pages/Login/Login';
import { TeamCode } from './pages/TeamCode/TeamCode';
import { MissionBrief } from './pages/MissionBrief/MissionBrief';
import { WarRoom } from './pages/WarRoom/WarRoom';
import { PromptCuration } from './pages/PromptCuration/PromptCuration';
import { FinalReveal } from './pages/FinalReveal/FinalReveal';
import { PresentationMode } from './pages/PresentationMode/PresentationMode';
import { Leaderboard } from './pages/Leaderboard/Leaderboard';

// Components
import { GlobalHeader } from './components/GlobalHeader/GlobalHeader';
import { ErrorModal } from './components/ErrorModal/ErrorModal';
import { PhaseFeedback } from './components/PhaseFeedback/PhaseFeedback';
import { PhaseInput } from './components/PhaseInput/PhaseInput';
import { AuthLoading } from './components/AuthLoading/AuthLoading';


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

// =============================================================================
// PAGE WRAPPERS (Connect pages to context and routing)
// =============================================================================

const MissionBriefPage: React.FC = () => {
    const { session, phaseConfig, initSessionFromTeamCode } = useApp();
    const { teamCodeInfo, clearTeamCode } = useAuth();
    const navigate = useNavigate();
    const [isInitializing, setIsInitializing] = React.useState(false);
    const [initError, setInitError] = React.useState<string | null>(null);

    // Initialize session from team code info if we don't have a session yet
    React.useEffect(() => {
        const initFromTeamCode = async () => {
            if (!session && teamCodeInfo && !isInitializing) {
                setIsInitializing(true);
                setInitError(null);

                try {
                    const result = await initSessionFromTeamCode(
                        teamCodeInfo.teamName,
                        teamCodeInfo.usecaseId
                    );

                    if (!result.success) {
                        setInitError('Failed to initialize session. Please try again.');
                    }
                } catch (err) {
                    setInitError('An error occurred while starting your session.');
                } finally {
                    setIsInitializing(false);
                }
            }
        };

        initFromTeamCode();
    }, [session, teamCodeInfo, isInitializing, initSessionFromTeamCode]);

    // Show loading while initializing
    if (isInitializing || (!session && teamCodeInfo)) {
        return (
            <div className="flex items-center justify-center h-screen flex-col gap-4">
                <div className="loading-spinner"></div>
                <p className="text-white/60">Preparing your mission...</p>
            </div>
        );
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
        return <Navigate to="/team-code" replace />;
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
        return <Navigate to="/login" replace />;
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
        return <Navigate to="/login" replace />;
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

const FinalRevealPage: React.FC = () => {
    const { session, activeRevealImage } = useApp();

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return (
        <FinalReveal
            session={session}
            imageUrl={activeRevealImage}
        />
    );
};

const PresentationModePage: React.FC = () => {
    const { session, generatedImageUrl } = useApp();

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return (
        <PresentationMode
            session={session}
            imageUrl={generatedImageUrl}
        />
    );
};

const LeaderboardPage: React.FC = () => {
    const { leaderboard, session } = useApp();

    return (
        <div className="full-screen-overlay animate-fadeIn overflow-y-auto custom-scrollbar">
            <Leaderboard
                entries={leaderboard}
                currentTeamId={session?.team_id}
            />
        </div>
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
        phaseConfig,
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
                currentPhaseNumber={session?.current_phase}
                totalPhases={Object.keys(phaseConfig).length}
            />

            {/* Main Content Area */}
            <main
                className={`flex-1 min-h-0 flex flex-col ${isWarRoom ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}
            >
                <Routes>
                    <Route path="/mission" element={<MissionBriefPage />} />
                    <Route path="/war-room" element={<WarRoomPage />} />
                    <Route path="/curate" element={<PromptCurationPage />} />
                    <Route path="/reveal" element={<FinalRevealPage />} />
                    <Route path="/present" element={<PresentationModePage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="*" element={<Navigate to="/mission" replace />} />
                </Routes>
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
    );
};

export default App;
