import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';

// Pages
import { UsecaseSelect } from './pages/UsecaseSelect/UsecaseSelect';
import { TeamInput } from './pages/TeamInput/TeamInput';
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

// =============================================================================
// PAGE WRAPPERS (Connect pages to context and routing)
// =============================================================================

const UsecaseSelectPage: React.FC = () => {
    return <UsecaseSelect />;
};

const TeamInputPage: React.FC = () => {
    const { selectedUsecase, loading, error } = useApp();

    if (!selectedUsecase) {
        return <Navigate to="/" replace />;
    }

    return (
        <TeamInput
            usecaseTitle={selectedUsecase.title}
            loading={loading}
            error={error}
        />
    );
};

const MissionBriefPage: React.FC = () => {
    const { session, phaseConfig } = useApp();

    if (!session) {
        return <Navigate to="/" replace />;
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
        return <Navigate to="/" replace />;
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
        return <Navigate to="/" replace />;
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
    const { session, generatedImageUrl, curatedPrompt } = useApp();

    if (!session) {
        return <Navigate to="/" replace />;
    }

    return (
        <FinalReveal
            session={session}
            imageUrl={generatedImageUrl}
            promptUsed={curatedPrompt}
        />
    );
};

const PresentationModePage: React.FC = () => {
    const { session, generatedImageUrl } = useApp();

    if (!session) {
        return <Navigate to="/" replace />;
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
// LAYOUT WITH HEADER
// =============================================================================
const AppLayout: React.FC = () => {
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
                    <Route path="/" element={<UsecaseSelectPage />} />
                    <Route path="/team" element={<TeamInputPage />} />
                    <Route path="/mission" element={<MissionBriefPage />} />
                    <Route path="/war-room" element={<WarRoomPage />} />
                    <Route path="/curate" element={<PromptCurationPage />} />
                    <Route path="/reveal" element={<FinalRevealPage />} />
                    <Route path="/present" element={<PresentationModePage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
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
            {error && location.pathname !== '/team' && (
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
    return (
        <AppProvider>
            <AppLayout />
        </AppProvider>
    );
};

export default App;
