import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../AppContext';
import { useAuth } from '../../providers';
import type { SessionState } from '../../types';
import { Branding } from '../Branding/Branding';
import './GlobalHeader.css';

interface GlobalHeaderProps {
    session: SessionState | null;
}

const Icons = {
    Trophy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
    ),
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M3 5h4" /><path d="M21 17v4" /><path d="M19 19h4" /></svg>
    ),
    ArrowLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    )
};

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
    session
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { resetToStart, fetchLeaderboard } = useApp();
    const { user } = useAuth();

    const currentPath = location.pathname;

    // Don't show header on landing/team input pages
    if (!session || ['/', '/team'].includes(currentPath)) {
        return null;
    }

    const getScoreTier = (score: number): { label: string; className: string } => {
        if (score >= 900) return { label: 'S', className: 'header-tier-badge--s' };
        if (score >= 800) return { label: 'A', className: 'header-tier-badge--a' };
        if (score >= 700) return { label: 'B', className: 'header-tier-badge--b' };
        if (score >= 500) return { label: 'C', className: 'header-tier-badge--c' };
        return { label: 'D', className: 'header-tier-badge--default' };
    };

    const tier = session ? getScoreTier(session.total_score) : null;

    const handleLogoClick = () => {
        resetToStart();
        navigate('/');
    };

    const handleViewLeaderboard = (e?: React.MouseEvent) => {
        e?.preventDefault();
        fetchLeaderboard();
        navigate('/leaderboard');
    };

    const renderLeftContent = () => {
        switch (currentPath) {
            case '/mission':
                return (
                    <div className="header-left-content">
                        <span className="header-phase-label">Mission Brief</span>
                    </div>
                );

            case '/war-room':
                return (
                    <div className="header-left-content">
                        <div className="header-project-info" style={{ borderLeft: 'none', paddingLeft: 0, marginLeft: 0 }}>
                            <span className="header-project-info__title" title={session?.usecase.title}>
                                {session?.usecase.title}
                            </span>
                        </div>
                    </div>
                );

            case '/curate':
                return null;

            case '/reveal':
                return (
                    <div className="header-left-content">
                        <div className="header-section-label">
                            <Icons.Sparkles />
                            <span>Final Reveal</span>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const renderCenterContent = () => {
        return <div className="global-header__center">{leftContent}</div>;
    };

    const renderRightContent = () => {
        if (!session) return null;
        return (
            <div className="global-header__right">
                <div className="header-score-pill reactive-border reactive-border--subtle">
                    {tier && (
                        <div className={`header-score-tier ${tier.className}`}>
                            {tier.label}
                        </div>
                    )}
                    <div className="header-score-content">
                        <span className="header-score-label-small">SCORE</span>
                        <span className="header-score-value-large">
                            {session.total_score.toFixed(0)}
                        </span>
                    </div>
                </div>

                <div className="global-header__divider global-header__divider--tall" />

                <button
                    onClick={handleViewLeaderboard}
                    className="header-leaderboard-btn reactive-border reactive-border--subtle"
                >
                    <Icons.Trophy />
                    <span className="header-leaderboard-btn__text">Ranks</span>
                </button>

                {user && (
                    <>
                        <div className="global-header__divider" />
                        <div className="header-user-profile reactive-border reactive-border--subtle" title={`Logon: ${user.name || 'User'} (${user.email})`}>
                            <div className="header-user-avatar">
                                {user.picture ? (
                                    <img src={user.picture} alt={user.name || 'User'} className="header-avatar-img" />
                                ) : (
                                    <span>{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            <div className="header-user-info">
                                <span className="header-user-name" title={user.name || user.email}>
                                    {user.name || user.email?.split('@')[0]}
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const leftContent = renderLeftContent();
    const centerContent = renderCenterContent();
    const rightContent = renderRightContent();

    return (
        <header className="global-header glass-panel">
            <div className="global-header__container">
                <div className="global-header__left">
                    <button
                        onClick={handleLogoClick}
                        className="global-header__logo-container"
                    >
                        <Branding isHeader showTitle={true} />
                    </button>
                </div>

                {centerContent}

                {rightContent}
            </div>
        </header>
    );
};
