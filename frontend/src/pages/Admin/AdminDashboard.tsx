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
import { VirtualList } from '../../components/VirtualList/VirtualList';
import { getApiUrl, getFullUrl } from '../../utils';
import type { LeaderboardEntry, SessionState, PitchSubmission } from '../../types';
import './AdminDashboard.css';

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

    // Search
    const [searchQuery, setSearchQuery] = useState('');

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
            setShowBroadcast(false);
            setBroadcastMsg('');
            alert('Broadcast Sent Successfully');
        } catch (err) {
            console.error('Broadcast failed:', err);
            alert('Failed to send broadcast');
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

    const activeTeams = useMemo(() => filteredTeams.filter(t => !t.is_completed), [filteredTeams]);
    const completedTeams = useMemo(() => filteredTeams.filter(t => t.is_completed), [filteredTeams]);

    // Chunk teams for VirtualGrid (3 per row)
    const chunkedActiveTeams = useMemo(() => {
        const chunks = [];
        for (let i = 0; i < activeTeams.length; i += 3) {
            chunks.push(activeTeams.slice(i, i + 3));
        }
        return chunks;
    }, [activeTeams]);

    const getSubmissions = (): PitchSubmission[] => {
        if (!selectedSession) return [];
        return selectedSession.uploadedImages || (selectedSession as any).uploaded_images || [];
    };

    // Render Row for VirtualList
    const renderTeamRow = (chunk: TeamData[], index: number, style: React.CSSProperties) => (
        <div key={index} style={{ ...style, display: 'flex', gap: '1.25rem' }}>
            {chunk.map(team => (
                <div key={team.session_id} style={{ flex: 1, minWidth: 0 }}>
                    <TeamCard team={team} onClick={() => setSelectedTeam(team)} />
                </div>
            ))}
            {/* Spacer for incomplete rows */}
            {[...Array(3 - chunk.length)].map((_, i) => (
                <div key={`spacer-${i}`} style={{ flex: 1, minWidth: 0 }} />
            ))}
        </div>
    );

    if (isLoading) {
        return (
            <div className="admin-dashboard">
                <TacticalLoader message="INITIALIZING COMMAND CENTER" subMessage="Establishing secure connection..." />
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            {/* Broadcast Modal */}
            {showBroadcast && (
                <div className="inspection-overlay" style={{ background: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        background: '#0f0f19', border: '1px solid #7c3aed', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '90%',
                        display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 0 50px rgba(124, 58, 237, 0.2)'
                    }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>SYSTEM BROADCAST</h2>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Message will appear instantly for all active mission sessions.</p>
                        <textarea
                            value={broadcastMsg}
                            onChange={(e) => setBroadcastMsg(e.target.value)}
                            placeholder="Enter alert message..."
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                padding: '1rem', height: '120px', color: '#fff', fontSize: '1rem', fontFamily: 'inherit', resize: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button
                                onClick={() => setShowBroadcast(false)}
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
                    // Team Detail View
                    <div className="team-detail">
                        <div className="detail-header">
                            <button className="back-btn" onClick={() => setSelectedTeam(null)}>
                                ← BACK TO TEAMS
                            </button>
                            <div className="team-info">
                                <h2>{selectedTeam.team_name}</h2>
                                <span className="mission-tag">{selectedTeam.usecase_title}</span>
                            </div>
                        </div>

                        {isDetailLoading ? (
                            <TacticalLoader message="LOADING TEAM DATA" />
                        ) : selectedSession ? (
                            <div className="detail-body">

                                <div className="stats-row">
                                    <div className="stat-card">
                                        <label>SCORE</label>
                                        <span className="stat-value">{Math.round(selectedSession.total_score)}</span>
                                    </div>
                                    <div className="stat-card">
                                        <label>PHASE</label>
                                        <span className="stat-value">
                                            {selectedSession.is_complete ? 'COMPLETE' : selectedSession.current_phase}
                                        </span>
                                    </div>
                                    <div className="stat-card">
                                        <label>TOKENS</label>
                                        <span className="stat-value">{selectedSession.total_tokens?.toLocaleString() || 0}</span>
                                    </div>
                                </div>

                                <div className="submissions-section">
                                    <h3>PITCH SUBMISSIONS ({getSubmissions().length}/3)</h3>
                                    {getSubmissions().length === 0 ? (
                                        <div className="empty-state">
                                            <span className="empty-icon">📂</span>
                                            <p>NO ASSETS SUBMITTED YET</p>
                                        </div>
                                    ) : (
                                        <div className="submissions-grid">
                                            {getSubmissions().map((sub, idx) => (
                                                <div key={idx} className="submission-card" onClick={() => setInspectedSubmission(sub)}>
                                                    <div className="submission-thumb">
                                                        <img src={getFullUrl(sub.image_url)} alt={`Submission ${idx + 1}`} />
                                                        <div className="thumb-overlay">
                                                            <span>INSPECT</span>
                                                        </div>
                                                    </div>
                                                    <div className="submission-meta">
                                                        <span className="sub-index">#{idx + 1}</span>
                                                        <span className="sub-score">{Math.round((sub.visual_score || 0) * 100)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="error-state">Failed to load session data</div>
                        )}
                    </div>
                ) : activeTab === 'catalog' ? (
                    // Usecase Catalog View
                    <div className="teams-view">
                        <div className="teams-toolbar">
                            <div className="toolbar-left">
                                <h2>MISSION ARCHIVES</h2>
                                <span className="team-count">{usecases.length} missions available</span>
                            </div>
                        </div>

                        <div className="teams-scroll">
                            <div className="team-grid">
                                {usecases.map((uc, i) => (
                                    <div key={uc.id || i} className="team-card" style={{ height: 'auto', minHeight: '200px' }}>
                                        <div className="card-header">
                                            <span className="team-name" style={{ fontSize: '1.1rem' }}>{uc.title}</span>
                                        </div>
                                        <div className="card-mission" style={{ marginTop: '0.5rem', color: '#a78bfa' }}>{uc.domain || 'General Domain'}</div>
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: '#94a3b8',
                                            margin: '1rem 0',
                                            lineHeight: '1.5',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 4,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {uc.description}
                                        </div>
                                        {/* Tag list */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: 'auto' }}>
                                            {uc.simulated_role && (
                                                <span className="mission-tag" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                                    ROLE: {uc.simulated_role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {usecases.length === 0 && (
                                <div className="empty-state">
                                    <span className="empty-icon">📁</span>
                                    <p>NO MISSIONS FOUND IN ARCHIVE</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Teams List View
                    <div className="teams-view">
                        <div className="teams-toolbar">
                            <div className="toolbar-left">
                                <h2>SQUAD TELEMETRY</h2>
                                <span className="team-count">{teams.length} teams • Last sync: {lastSync.toLocaleTimeString()}</span>
                            </div>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Filter teams..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="teams-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
                            {activeTeams.length > 0 && (
                                <section className="team-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h3 className="section-label">ACTIVE ({activeTeams.length})</h3>
                                    {/* Virtual Grid for Active Teams */}
                                    {/* Dynamic height: Shrink to fit content, max 600px */}
                                    <div style={{ flex: 'none' }}>
                                        <VirtualList
                                            items={chunkedActiveTeams}
                                            height={Math.min(chunkedActiveTeams.length * 200, 600)}
                                            itemHeight={200}
                                            renderItem={renderTeamRow}
                                        />
                                    </div>
                                </section>
                            )}

                            {completedTeams.length > 0 && (
                                <section className="team-section">
                                    <h3 className="section-label completed">COMPLETED ({completedTeams.length})</h3>
                                    <div className="team-grid">
                                        {completedTeams.map(team => (
                                            <TeamCard key={team.session_id} team={team} onClick={() => setSelectedTeam(team)} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {filteredTeams.length === 0 && (
                                <div className="empty-state">
                                    <span className="empty-icon">📡</span>
                                    <p>NO ACTIVE SQUADRONS IN RANGE</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main >
        </div >
    );
};

// Team Card Component
interface TeamCardProps {
    team: TeamData;
    onClick: () => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onClick }) => (
    <div className={`team-card ${team.is_completed ? 'completed' : ''}`} onClick={onClick} style={{ height: '100%' }}>
        <div className="card-header">
            <span className="team-name">{team.team_name}</span>
            <span className="team-score">{Math.round(team.score)}</span>
        </div>
        <div className="card-mission">{team.usecase_title}</div>
        <div className="card-progress">
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${team.progress}%` }} />
            </div>
            <span className="progress-label">{team.is_completed ? 'COMPLETE' : team.current_phase}</span>
        </div>
    </div>
);
