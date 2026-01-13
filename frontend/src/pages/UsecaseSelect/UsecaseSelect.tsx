import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import { getApiUrl } from '../../utils';
import type { UseCase, Theme } from '../../types';
import './UsecaseSelect.css';

const Icons = {
    FinTech: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
    ),
    HealthTech: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 6 4 6-4 6-4-6 4-6Z" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M12 2v4" /><path d="M12 18v4" /></svg>
    ),
    EdTech: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
    ),
    Sustainability: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C10 14.52 12 13 13 12" /></svg>
    ),
    Logistics: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
    ),
    AI: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
    ),
    Ecommerce: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
    ),
    SaaS: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a3.5 3.5 0 1 1-5.8-3.41" /><path d="M22 19c0-1.2-.5-2.26-1.3-3" /><path d="M16 11c0-1.5-1.5-3-3.1-3a3.5 3.5 0 0 0-6.8 2.2 2 2 0 0 0-1.1 3.8" /><path d="M20 11a3 3 0 0 0-5.5-1.5" /><path d="M9 19c0-1 .7-1.9 1.6-2.2" /><path d="M3 19c0-1 .7-1.9 1.6-2.2" /></svg>
    ),
    Default: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>
    ),
    Check: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    ArrowRight: () => (
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
    )
};

export const UsecaseSelect: React.FC = () => {
    const navigate = useNavigate();
    const { setSelectedUsecase, setSelectedTheme } = useApp();

    const [usecases, setUsecases] = useState<UseCase[]>([]);
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedUsecaseLocal, setSelectedUsecaseLocal] = useState<UseCase | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(getApiUrl('/api/usecases'));
                if (res.ok) {
                    const data = await res.json();
                    setUsecases(data.usecases || []);
                    setThemes(data.themes || []);
                }
            } catch (e) {
                console.error('Failed to fetch usecases', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleContinue = () => {
        if (selectedUsecaseLocal && themes.length > 0) {
            const matchedTheme = themes[Math.floor(Math.random() * themes.length)];
            setSelectedUsecase(selectedUsecaseLocal);
            setSelectedTheme(matchedTheme);
            navigate('/team');
        }
    };

    const getDomainIcon = (domain: string) => {
        const d = domain.toLowerCase();
        if (d.includes('fin')) return <Icons.FinTech />;
        if (d.includes('health')) return <Icons.HealthTech />;
        if (d.includes('ed')) return <Icons.EdTech />;
        if (d.includes('sus')) return <Icons.Sustainability />;
        if (d.includes('log')) return <Icons.Logistics />;
        if (d.includes('ai') || d.includes('ml')) return <Icons.AI />;
        if (d.includes('e-comm')) return <Icons.Ecommerce />;
        if (d.includes('saas')) return <Icons.SaaS />;
        return <Icons.Default />;
    };


    if (loading) {
        return (
            <div className="usecase-select war-room-bg usecase-select__loading min-h-screen">
                <div className="usecase-select__loading-content">
                    <div className="usecase-select__loading-spinner loading-spinner" />
                    <p className="usecase-select__loading-text">INITIALIZING MISSION REPO...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="usecase-select war-room-bg">

            <div className="usecase-select__container">
                {/* Header */}
                <div className="usecase-select__header animate-slideUp">
                    <h1 className="usecase-select__title">
                        <span className="text-gradient">SELECT</span>
                        <span className="text-white"> YOUR MISSION</span>
                    </h1>
                    <p className="usecase-select__subtitle">
                        Deployment ready. Choose a startup challenge to simulate.
                    </p>
                </div>

                {/* Usecase Grid */}
                <div className="usecase-select__grid" role="listbox" aria-label="Available missions">
                    {usecases.map((usecase, idx) => (
                        <div
                            key={usecase.id}
                            role="option"
                            tabIndex={0}
                            aria-selected={selectedUsecaseLocal?.id === usecase.id}
                            onClick={() => setSelectedUsecaseLocal(usecase)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedUsecaseLocal(usecase);
                                }
                            }}
                            className={`usecase-card glass-card animate-fadeIn ${selectedUsecaseLocal?.id === usecase.id ? 'usecase-card--selected' : ''}`}
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            {/* Icon & Domain */}
                            <div className="usecase-card__header">
                                <span className={`usecase-card__icon ${selectedUsecaseLocal?.id === usecase.id ? 'usecase-card__icon--selected' : ''}`}>
                                    {getDomainIcon(usecase.domain)}
                                </span>
                                <span className="usecase-card__domain">
                                    {usecase.domain}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="usecase-card__title">
                                {usecase.title}
                            </h3>

                            {/* Target Market */}
                            <p className="usecase-card__description">
                                {usecase.description || usecase.target_market}
                            </p>

                            {/* Footer info */}
                            <div className="usecase-card__footer">
                                {selectedUsecaseLocal?.id === usecase.id && (
                                    <div className="usecase-card__check">
                                        <Icons.Check />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Continue Button */}
                <div className="usecase-select__actions animate-fadeIn stagger-2">
                    <button
                        onClick={handleContinue}
                        disabled={!selectedUsecaseLocal}
                        className="usecase-select__continue-btn btn-primary"
                    >
                        {selectedUsecaseLocal ? (
                            <>
                                Begin Deployment
                                <Icons.ArrowRight />
                            </>
                        ) : (
                            'Select Mission Path'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
