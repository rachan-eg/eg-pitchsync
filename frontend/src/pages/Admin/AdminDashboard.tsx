/**
 * Admin Command Center Dashboard
 * Complete revamp with proper state management and styling
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../providers';
import { Leaderboard } from '../Leaderboard/Leaderboard';
import { FinalReveal } from '../FinalReveal/FinalReveal';
import { TacticalLoader } from '../../components/TacticalLoader';
import { Branding } from '../../components/Branding/Branding';
import { getApiUrl, getFullUrl } from '../../utils';
import type { LeaderboardEntry, SessionState, PitchSubmission } from '../../types';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { appendTranscript } from '../../utils/transcriptParser';
import './AdminDashboard.css';
import { playBroadcastSound } from '../../utils/audio';

interface TeamData {
    session_id: string;
    team_name: string;
    usecase_id: string;
    usecase_title: string;
    progress: number;
    current_phase: string;
    score: number;
    last_active: string;
    is_completed: boolean;
    total_tokens: number;
    user_name?: string;
    user_email?: string;
    contributors?: { name: string, email: string }[];
}

export const AdminDashboard: React.FC = () => {
    const { adminWelcomeShown, setAdminWelcomeShown, adminToken, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'teams' | 'catalog'>('leaderboard');
    const [showWelcome, setShowWelcome] = useState(false);

    // Data States
    const [teams, setTeams] = useState<TeamData[]>([]);
    const [usecases, setUsecases] = useState<any[]>([]);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSync, setLastSync] = useState(new Date());

    // Team Detail States
    const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
    const [selectedSession, setSelectedSession] = useState<SessionState | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Submission Inspection States
    const [inspectedSubmission, setInspectedSubmission] = useState<PitchSubmission | null>(null);

    // Broadcast State
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // Search and Sort
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'score' | 'recent' | 'progress'>('recent');

    // Toast notification
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // --- VOICE INPUT ---
    const {
        state: voiceState,
        toggle: toggleVoice,
        stop: stopVoice,
        volume: voiceVolume,
    } = useVoiceInput({
        lang: 'en-IN',
        onFinalSegment: (text, pauseDuration) => {
            setBroadcastMsg(prev => appendTranscript(prev, text, pauseDuration));
        }
    });

    const isListening = voiceState === 'listening' || voiceState === 'requesting';

    // Welcome Toast
    useEffect(() => {
        if (!adminWelcomeShown && user) {
            setShowWelcome(true);
            const timer = setTimeout(() => {
                setShowWelcome(false);
                setAdminWelcomeShown(true);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [adminWelcomeShown, setAdminWelcomeShown, user]);

    // Fetch all data
    const fetchData = useCallback(async () => {
        if (!adminToken) return;
        if (document.hidden) return; // Pause polling when hidden

        try {
            // Fetch leaderboard
            const lbRes = await fetch(getApiUrl('/api/leaderboard'));
            if (lbRes.ok) {
                const lbData = await lbRes.json();
                setLeaderboardData((lbData.entries || []).slice(0, 50));
            }

            // Fetch teams
            const teamsRes = await fetch(getApiUrl('/api/admin/teams'), {
                headers: { 'X-Admin-Token': adminToken }
            });

            if (teamsRes.status === 401) {
                handleExit();
                return;
            }

            if (teamsRes.ok) {
                const teamsData = await teamsRes.json();
                setTeams(teamsData.teams || []);
            }

            // Fetch usecases (only need to do this occasionally, but for simplicity we do it here)
            // Ideally should be separate useEffect
            const ucRes = await fetch(getApiUrl('/api/admin/usecases'), {
                headers: { 'X-Admin-Token': adminToken }
            });
            if (ucRes.ok) {
                const ucData = await ucRes.json();
                setUsecases(ucData.usecases || []);
            }

            setLastSync(new Date());
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [adminToken]);

    // Fetch team detail
    const fetchTeamDetail = useCallback(async (sessionId: string) => {
        if (!adminToken) return;
        setIsDetailLoading(true);

        try {
            const res = await fetch(getApiUrl(`/api/admin/teams/${sessionId}`), {
                headers: { 'X-Admin-Token': adminToken }
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedSession(data.session || null);
            }
        } catch (err) {
            console.error('Failed to fetch team detail:', err);
        } finally {
            setIsDetailLoading(false);
        }
    }, [adminToken]);



    // Send Broadcast
    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim() || !adminToken) return;
        setIsBroadcasting(true);
        try {
            await fetch(getApiUrl('/api/admin/broadcast'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': adminToken
                },
                body: JSON.stringify({ message: broadcastMsg, active: true })
            });

            // Play success sound
            playBroadcastSound();

            if (isListening) stopVoice();
            setShowBroadcast(false);
            setBroadcastMsg('');

            // Show success toast
            setToast({ message: 'Transmission sent successfully', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (err) {
            console.error('Broadcast failed:', err);
            setToast({ message: 'Failed to send transmission', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setIsBroadcasting(false);
        }
    };

    // Initial load and polling
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Fetch detail when team selected
    useEffect(() => {
        if (selectedTeam) {
            fetchTeamDetail(selectedTeam.session_id);
        } else {
            setSelectedSession(null);
            setInspectedSubmission(null);
        }
    }, [selectedTeam, fetchTeamDetail]);

    const handleExit = () => {
        sessionStorage.removeItem('pitch_sync_is_admin');
        sessionStorage.removeItem('pitch_sync_admin_token');
        window.location.href = '/team-code';
    };

    // Filtered teams
    const filteredTeams = useMemo(() => {
        if (!searchQuery) return teams;
        const q = searchQuery.toLowerCase();
        return teams.filter(t =>
            t.team_name.toLowerCase().includes(q) ||
            t.usecase_id.toLowerCase().includes(q)
        );
    }, [teams, searchQuery]);

    const selectedUsecase = useMemo(() => {
        if (!selectedTeam || !usecases) return null;
        return usecases.find(u => u.id === selectedTeam.usecase_id);
    }, [selectedTeam, usecases]);

    // Helper: Get score tier color
    const getScoreTier = (score: number): { label: string; color: string } => {
        if (score >= 900) return { label: 'S', color: '#FFD700' };
        if (score >= 800) return { label: 'A', color: '#10B981' };
        if (score >= 700) return { label: 'B', color: '#3B82F6' };
        if (score >= 500) return { label: 'C', color: '#9f6ac2ff' };
        return { label: 'D', color: '#b39f9fff' };
    };

    // Helper: Time ago formatting
    const getTimeAgo = (dateStr: string): string => {
        const now = new Date();
        const then = new Date(dateStr);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    // Base filtered lists
    const activeTeams = useMemo(() => filteredTeams.filter(t => !t.is_completed), [filteredTeams]);
    const completedTeams = useMemo(() => filteredTeams.filter(t => t.is_completed), [filteredTeams]);

    // Aggregate Stats
    const aggregateStats = useMemo(() => {
        if (teams.length === 0) return { avgScore: 0, completionRate: 0, totalTokens: 0 };
        const avgScore = Math.round(teams.reduce((sum, t) => sum + t.score, 0) / teams.length);
        const completionRate = Math.round((completedTeams.length / teams.length) * 100);
        const totalTokens = teams.reduce((sum, t) => sum + (t.total_tokens || 0), 0);
        return { avgScore, completionRate, totalTokens };
    }, [teams, completedTeams]);

    // Sorting function
    const sortTeams = (teamsToSort: TeamData[]): TeamData[] => {
        const sorted = [...teamsToSort];
        switch (sortBy) {
            case 'score':
                return sorted.sort((a, b) => b.score - a.score);
            case 'progress':
                return sorted.sort((a, b) => b.progress - a.progress);
            case 'recent':
            default:
                return sorted.sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
        }
    };

    // Sorted teams (derived from base lists)
    const sortedActiveTeams = useMemo(() => sortTeams(activeTeams), [activeTeams, sortBy]);
    const sortedCompletedTeams = useMemo(() => sortTeams(completedTeams), [completedTeams, sortBy]);

    const getSubmissions = (): PitchSubmission[] => {
        if (!selectedSession) return [];
        return selectedSession.uploadedImages || (selectedSession as any).uploaded_images || [];
    };

    if (isLoading) {
        return (
            <div className="admin-dashboard">
                <TacticalLoader message="INITIALIZING COMMAND CENTER" subMessage="Establishing secure connection..." />
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            {/* Toast Notification */}
            {toast && (
                <div className={`admin-toast admin-toast--${toast.type}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {toast.type === 'success' ? (
                            <><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></>
                        ) : (
                            <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                        )}
                    </svg>
                    {toast.message}
                </div>
            )}

            {/* Broadcast Modal */}
            {showBroadcast && (
                <div className="inspection-overlay" style={{ background: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        background: '#0f0f19', border: '1px solid #7c3aed', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '90%',
                        display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 0 50px rgba(124, 58, 237, 0.2)'
                    }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>SYSTEM BROADCAST</h2>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Message will appear instantly for all active mission sessions.</p>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                                placeholder={isListening ? "Listening..." : "Enter alert message..."}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                    padding: '1rem', height: '120px', color: '#fff', fontSize: '1rem', fontFamily: 'inherit', resize: 'none',
                                    paddingRight: '3.5rem', width: '100%', boxSizing: 'border-box'
                                }}
                            />
                            <button
                                onClick={toggleVoice}
                                style={{
                                    position: 'absolute', right: '12px', bottom: '12px',
                                    background: isListening ? '#ef4444' : 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.5)' : 'none',
                                    transform: `scale(${isListening ? 1 + (voiceVolume * 0.3) : 1})`,
                                    zIndex: 10
                                }}
                                title={isListening ? "Stop Voice Input" : "Start Voice Input"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button
                                onClick={() => {
                                    if (isListening) stopVoice();
                                    setShowBroadcast(false);
                                }}
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1', fontWeight: 700 }}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleSendBroadcast}
                                disabled={isBroadcasting}
                                style={{
                                    padding: '0.75rem 1.5rem', borderRadius: '6px', background: '#7c3aed', border: 'none', color: '#fff', fontWeight: 700,
                                    opacity: isBroadcasting ? 0.7 : 1
                                }}
                            >
                                {isBroadcasting ? 'TRANSMITTING...' : 'SEND TRANSMISSION'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Toast */}
            {showWelcome && (
                <div className="welcome-toast">
                    <div className="welcome-avatar">
                        {user?.picture ? (
                            <img src={user.picture} alt="" />
                        ) : (
                            <span>{user?.name?.charAt(0) || 'A'}</span>
                        )}
                    </div>
                    <div className="welcome-info">
                        <span className="welcome-label">COMMAND ACCESS GRANTED</span>
                        <span className="welcome-name">{user?.name || 'Administrator'}</span>
                    </div>
                    <div className="welcome-timer" />
                </div>
            )}

            {/* Header */}
            <header className="admin-header">
                <div className="header-brand">
                    <Branding isHeader showTitle />
                    <span className="admin-badge">COMMAND</span>
                </div>

                <nav className="header-nav">
                    <button
                        className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('leaderboard'); setSelectedTeam(null); }}
                    >
                        LEADERBOARD
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
                        onClick={() => setActiveTab('teams')}
                    >
                        TEAMS
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'catalog' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('catalog'); setSelectedTeam(null); }}
                    >
                        CATALOG
                    </button>
                </nav>

                <div className="header-actions">
                    <button
                        className="nav-tab"
                        style={{ color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '4px' }}
                        onClick={() => setShowBroadcast(true)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12" />
                            <circle cx="17" cy="7" r="5" />
                        </svg>
                        BROADCAST
                    </button>
                    <div className="sync-status">
                        <span className="sync-dot" />
                        <span className="sync-text">LIVE</span>
                    </div>
                    <button className="exit-btn" onClick={handleExit}>
                        EXIT
                    </button>
                </div>
            </header >

            {/* Main Content */}
            < main className="admin-main" >
                {activeTab === 'leaderboard' ? (
                    <div className="leaderboard-view">
                        <Leaderboard entries={leaderboardData} hideTitle hideBackButton />
                    </div>
                ) : inspectedSubmission && selectedSession ? (
                    // Submission Inspection View
                    <div className="inspection-overlay">
                        <FinalReveal
                            session={selectedSession}
                            imageUrl={getFullUrl(inspectedSubmission.image_url)}
                            selectedSubmission={inspectedSubmission}
                            readOnly={true}
                            onBack={() => setInspectedSubmission(null)}
                        />
                    </div>
                ) : selectedTeam ? (
                    // Team Detail View - Compact Design
                    <div className="td-page">
                        {/* Compact Header */}
                        <div className="td-topbar">
                            <button className="td-back" onClick={() => setSelectedTeam(null)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                                BACK
                            </button>
                            <div className="td-title-group">
                                <div>
                                    <h1>{selectedTeam.team_name}</h1>
                                    {(selectedTeam.contributors && selectedTeam.contributors.length > 0) ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            {selectedTeam.contributors.map((c, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                                                    <span>👤 {c.name}</span>
                                                    <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>&lt;{c.email}&gt;</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : selectedTeam.user_name && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#94a3b8', marginTop: '4px' }}>
                                            <span>👤 {selectedTeam.user_name}</span>
                                            {selectedTeam.user_email && <span style={{ opacity: 0.7 }}>&lt;{selectedTeam.user_email}&gt;</span>}
                                        </div>
                                    )}
                                </div>
                                <span className={`td-badge ${selectedTeam.is_completed ? 'complete' : 'active'}`}>
                                    {selectedTeam.is_completed ? '✓ COMPLETE' : '◉ ACTIVE'}
                                </span>
                            </div>
                            <span className="td-id">#{selectedTeam.session_id.slice(0, 8).toUpperCase()}</span>
                        </div>

                        {isDetailLoading ? (
                            <TacticalLoader message="LOADING TEAM DATA" />
                        ) : selectedSession ? (
                            <div className="td-body">
                                {/* Top Section: Score + Stats + Intel */}
                                <div className="td-top-section">
                                    {/* Score Card */}
                                    <div className="td-score-card">
                                        <svg className="td-ring" viewBox="0 0 100 100">
                                            <circle className="td-ring-bg" cx="50" cy="50" r="42" />
                                            <circle
                                                className="td-ring-fill"
                                                cx="50" cy="50" r="42"
                                                style={{
                                                    strokeDasharray: `${(Math.min(selectedSession.total_score, 200) / 200) * 264} 264`
                                                }}
                                            />
                                        </svg>
                                        <div className="td-score-text">
                                            <span className="td-score-num">{Math.round(selectedSession.total_score)}</span>
                                            <span className="td-score-pts">pts</span>
                                        </div>
                                    </div>

                                    {/* Stats Grid - Premium Tactical Redesign */}
                                    <div className="td-stats-grid">
                                        <div className="td-stat td-stat--tier">
                                            <div className="td-tier-badge" style={{
                                                color: getScoreTier(selectedSession.total_score).color,
                                                borderColor: getScoreTier(selectedSession.total_score).color + '30',
                                            }}>
                                                {getScoreTier(selectedSession.total_score).label}
                                            </div>
                                            <span className="td-stat-lbl">TEAM RANK</span>
                                        </div>

                                        <div className="td-stat">
                                            <span className="td-stat-val">
                                                {Object.values(selectedSession.phases || {}).reduce((acc, p) =>
                                                    acc + (p.responses?.filter((r: any) => r.hint_used).length || 0), 0
                                                )}
                                            </span>
                                            <span className="td-stat-lbl">HINTS USED</span>
                                        </div>

                                        <div className="td-stat">
                                            <span className="td-stat-val">{(selectedSession.total_tokens || 0).toLocaleString()}</span>
                                            <span className="td-stat-lbl">TOTAL TOKENS</span>
                                        </div>

                                        <div className="td-stat">
                                            <span className="td-stat-val">
                                                {Object.values(selectedSession.phases || {}).filter(p => p.status === 'passed' || p.status === 'submitted').length}
                                                /3
                                            </span>
                                            <span className="td-stat-lbl">PHASES DONE</span>
                                        </div>
                                    </div>

                                    {/* Mission Info */}
                                    <div className="td-mission-info">
                                        <div className="td-mission-header">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <path d="M14 2v6h6" />
                                            </svg>
                                            MISSION BRIEF
                                        </div>
                                        <div className="td-mission-body">
                                            <div className="td-mission-row">
                                                <div className="td-field">
                                                    <label>Domain</label>
                                                    <span>{selectedUsecase?.domain || 'General'}</span>
                                                </div>
                                                <div className="td-field">
                                                    <label>Use Case</label>
                                                    <span>{selectedUsecase?.title || selectedTeam.usecase_title}</span>
                                                </div>
                                            </div>
                                            <div className="td-field td-desc">
                                                <label>Objective</label>
                                                <p>{selectedUsecase?.description || 'Mission details not specified.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gallery Section */}
                                <div className="td-gallery-section">
                                    <div className="td-gallery-title">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <path d="M21 15l-5-5L5 21" />
                                        </svg>
                                        <span>PITCH VISUALS</span>
                                        <span className="td-gallery-count">{getSubmissions().length}/3</span>
                                    </div>

                                    {getSubmissions().length === 0 ? (
                                        <div className="td-no-assets">
                                            <span>No visual assets uploaded yet</span>
                                        </div>
                                    ) : (
                                        <div className="td-assets">
                                            {getSubmissions().map((sub, idx) => (
                                                <div
                                                    key={idx}
                                                    className="td-asset"
                                                    onClick={() => setInspectedSubmission(sub)}
                                                >
                                                    <div className="td-asset-img">
                                                        <img src={getFullUrl(sub.image_url)} alt={`Asset ${idx + 1}`} />
                                                        <div className="td-asset-hover">
                                                            <span>INSPECT</span>
                                                        </div>
                                                    </div>
                                                    <div className="td-asset-meta">
                                                        <span className="td-asset-num">#{idx + 1}</span>
                                                        <span className="td-asset-pct">{Math.round((sub.visual_score || 0) * 100)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="td-err">Failed to load session data</div>
                        )}
                    </div>
                ) : activeTab === 'catalog' ? (
                    // Mission Catalog View - Simplified
                    <div className="catalog-view">
                        <div className="catalog-header">
                            <div className="catalog-header-left">
                                <div className="catalog-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                        <polyline points="10 6 13 9 10 12" />
                                    </svg>
                                </div>
                                <div>
                                    <h2>MISSION ARCHIVES</h2>
                                    <span className="catalog-subtitle">Available scenarios</span>
                                </div>
                            </div>
                            <div className="catalog-header-right">
                                <div className="catalog-stat">
                                    <span className="catalog-stat-value">{usecases.length}</span>
                                    <span className="catalog-stat-label">Usecases</span>
                                </div>
                            </div>
                        </div>

                        <div className="catalog-grid">
                            {usecases.map((uc, i) => (
                                <div key={uc.id || i} className="mission-card">
                                    <div className="mission-card-header">
                                        <div className="mission-domain">{uc.domain || 'General'}</div>
                                    </div>

                                    <h3 className="mission-title">{uc.title}</h3>

                                    <div className="mission-description-wrap">
                                        <p className="mission-description">{uc.description}</p>
                                        <div className="mission-description-tooltip">{uc.description}</div>
                                    </div>

                                    {uc.simulated_role && (
                                        <div className="mission-role">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            {uc.simulated_role}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {usecases.length === 0 && (
                            <div className="catalog-empty">
                                <div className="empty-icon">
                                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                        <line x1="9" y1="10" x2="15" y2="10" />
                                    </svg>
                                </div>
                                <p>NO MISSIONS IN ARCHIVE</p>
                                <span className="empty-sub">Mission scenarios will appear here</span>
                            </div>
                        )}
                    </div>
                ) : (
                    // Teams List View - Redesigned Two-Panel Layout
                    <div className="teams-view">
                        {/* Aggregate Stats Bar */}
                        <div className="stats-bar">
                            <div className="stats-bar-item">
                                <span className="stats-bar-value">{aggregateStats.avgScore}</span>
                                <span className="stats-bar-label">AVG SCORE</span>
                            </div>
                            <div className="stats-bar-divider" />
                            <div className="stats-bar-item">
                                <span className="stats-bar-value">{aggregateStats.completionRate}%</span>
                                <span className="stats-bar-label">COMPLETION</span>
                            </div>
                            <div className="stats-bar-divider" />
                            <div className="stats-bar-item">
                                <span className="stats-bar-value">{(aggregateStats.totalTokens / 1000).toFixed(1)}K</span>
                                <span className="stats-bar-label">TOKENS</span>
                            </div>
                        </div>

                        <div className="teams-toolbar">
                            <div className="toolbar-left">
                                <h2>SQUAD TELEMETRY</h2>
                                <span className="team-count">{teams.length} teams • Last sync: {lastSync.toLocaleTimeString()}</span>
                            </div>
                            <div className="toolbar-right">
                                {/* Sort Controls */}
                                <div className="sort-controls">
                                    <span className="sort-label">Sort:</span>
                                    <button
                                        className={`sort-btn ${sortBy === 'recent' ? 'active' : ''}`}
                                        onClick={() => setSortBy('recent')}
                                    >
                                        Recent
                                    </button>
                                    <button
                                        className={`sort-btn ${sortBy === 'score' ? 'active' : ''}`}
                                        onClick={() => setSortBy('score')}
                                    >
                                        Score
                                    </button>
                                    <button
                                        className={`sort-btn ${sortBy === 'progress' ? 'active' : ''}`}
                                        onClick={() => setSortBy('progress')}
                                    >
                                        Progress
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search teams..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="teams-panels">
                            {/* Active Teams Panel */}
                            <div className="teams-panel teams-panel--active">
                                <div className="panel-header">
                                    <div className="panel-indicator active" />
                                    <h3>IN PROGRESS</h3>
                                    <span className="panel-count">{activeTeams.length}</span>
                                </div>
                                <div className="panel-content">
                                    {sortedActiveTeams.length > 0 ? (
                                        <div className="team-list">
                                            {sortedActiveTeams.map(team => {
                                                const tier = getScoreTier(team.score);
                                                return (
                                                    <div
                                                        key={team.session_id}
                                                        className="team-card"
                                                        onClick={() => setSelectedTeam(team)}
                                                    >
                                                        <div className="card-header">
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span className="team-name">{team.team_name}</span>
                                                                {team.contributors && team.contributors.length > 0 ? (
                                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                        • {team.contributors.map(c => c.name).join(', ')}
                                                                    </span>
                                                                ) : team.user_name && (
                                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>• {team.user_name}</span>
                                                                )}
                                                            </div>
                                                            <span className="team-score" style={{ color: tier.color, background: `${tier.color}20` }}>
                                                                {Math.round(team.score)}
                                                            </span>
                                                        </div>
                                                        <div className="card-mission">{team.usecase_title}</div>
                                                        <div className="card-progress">
                                                            <div className="progress-bar">
                                                                <div className="progress-fill" style={{ width: `${team.progress}%` }} />
                                                            </div>
                                                            <span className="progress-label">{team.current_phase}</span>
                                                        </div>
                                                        <div className="card-meta">
                                                            <span className="card-time">{getTimeAgo(team.last_active)}</span>
                                                            <span className="card-tier" style={{ color: tier.color }}>{tier.label}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="panel-empty">
                                            <div className="empty-icon">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                            </div>
                                            <p>No active sessions</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Completed Teams Panel */}
                            <div className="teams-panel teams-panel--completed">
                                <div className="panel-header">
                                    <div className="panel-indicator completed" />
                                    <h3>MISSION COMPLETE</h3>
                                    <span className="panel-count">{completedTeams.length}</span>
                                </div>
                                <div className="panel-content">
                                    {sortedCompletedTeams.length > 0 ? (
                                        <div className="team-list">
                                            {sortedCompletedTeams.map(team => {
                                                const tier = getScoreTier(team.score);
                                                return (
                                                    <div
                                                        key={team.session_id}
                                                        className="team-card completed"
                                                        onClick={() => setSelectedTeam(team)}
                                                    >
                                                        <div className="card-header">
                                                            <span className="team-name">{team.team_name}</span>
                                                            <span className="team-score" style={{ color: tier.color, background: `${tier.color}20` }}>
                                                                {Math.round(team.score)}
                                                            </span>
                                                        </div>
                                                        <div className="card-mission">{team.usecase_title}</div>
                                                        <div className="card-progress">
                                                            <div className="progress-bar">
                                                                <div className="progress-fill" style={{ width: `${team.progress}%` }} />
                                                            </div>
                                                            <span className="progress-label">COMPLETE</span>
                                                        </div>
                                                        <div className="card-meta">
                                                            <span className="card-time">{getTimeAgo(team.last_active)}</span>
                                                            <span className="card-tier" style={{ color: tier.color }}>{tier.label}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="panel-empty">
                                            <div className="empty-icon">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M9 12l2 2 4-4" />
                                                </svg>
                                            </div>
                                            <p>No completions yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {filteredTeams.length === 0 && (
                            <div className="teams-empty-overlay">
                                <div className="empty-icon">
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                                        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                                        <circle cx="12" cy="12" r="2" />
                                        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                                        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
                                    </svg>
                                </div>
                                <p>NO SQUADRONS DETECTED</p>
                                <span className="empty-sub">Awaiting team connections...</span>
                            </div>
                        )}
                    </div>
                )}
            </main >
        </div >
    );
};
