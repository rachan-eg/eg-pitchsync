import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Theme, SessionState } from '../../types';
import './PromptCuration.css';

// =============================================================================
// TYPES
// =============================================================================
interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

const LOADING_STATUSES = [
    "Compiling Strategic Inputs...",
    "Initializing Semantic Synthesis...",
    "Calibrating Creative Vectors...",
    "Generating Narrative Matrix...",
    "Refining Aesthetic Parameters...",
    "Finalizing Image Manifest..."
];

interface PromptCurationProps {
    session: SessionState;
    curatedPrompt: string;
    usecaseTitle: string;
    theme: Theme;
    totalScore: number;
    isLoading: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================
const REF_IMAGES = [
    '/backend-assets/Image_refernces/image.png',
    '/backend-assets/Image_refernces/image%20copy.png'
];

// =============================================================================
// ICONS
// =============================================================================
const Icons = {
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    ),
    Copy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    Zap: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    ),
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
    ),
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    )
};

// =============================================================================
// HELPERS
// =============================================================================
// Tier thresholds: S=900, A=800, B=700, C=500 (must match GlobalHeader)
const getScoreTier = (score: number): { label: string; colorClass: string } => {
    if (score >= 900) return { label: 'S-TIER', colorClass: 'text-warning' };
    if (score >= 800) return { label: 'A-TIER', colorClass: 'text-success' };
    if (score >= 700) return { label: 'B-TIER', colorClass: 'text-primary' };
    if (score >= 500) return { label: 'C-TIER', colorClass: 'text-dim' };
    return { label: 'D-TIER', colorClass: 'text-muted' };
};

// =============================================================================
// COMPONENT
// =============================================================================
export const PromptCuration: React.FC<PromptCurationProps> = ({
    session,
    curatedPrompt,
    usecaseTitle: _usecaseTitle,
    theme: _theme,
    totalScore,
    isLoading
}) => {
    const navigate = useNavigate();
    const { regeneratePrompt, generateImage, totalTokens } = useApp();

    const [editedPrompt, setEditedPrompt] = useState(curatedPrompt);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
    const [copied, setCopied] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);

    // Cycle through loading statuses
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLoading) {
            interval = setInterval(() => {
                setStatusIndex(prev => (prev + 1) % LOADING_STATUSES.length);
            }, 1800);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    useEffect(() => {
        if (curatedPrompt) {
            let promptStr = typeof curatedPrompt === 'string' ? curatedPrompt : JSON.stringify(curatedPrompt, null, 2);

            // UX IMPROVEMENT: Try to unwrap JSON to show raw text
            try {
                // If it looks like JSON object
                if (promptStr.trim().startsWith('{')) {
                    const parsed = JSON.parse(promptStr);
                    if (parsed.final_combined_prompt) {
                        promptStr = parsed.final_combined_prompt;
                    }
                }
            } catch {
                // Ignore parse errors, just show raw string
            }

            setEditedPrompt(promptStr);
        }
    }, [curatedPrompt]);

    const handleRegenerate = async () => {
        if (!additionalNotes.trim()) return;
        setIsRegenerating(true);
        try {
            const newHistory = [...conversationHistory, { role: 'user' as const, content: additionalNotes.trim() }];
            await regeneratePrompt(additionalNotes.trim(), newHistory);
            setConversationHistory([...newHistory, { role: 'assistant' as const, content: 'Applied' }]);
            setAdditionalNotes('');
        } catch (error) {
            console.error('Regeneration failed:', error);
        } finally {
            setIsRegenerating(false);
        }
    };



    const handleDownloadImages = async () => {
        try {
            const zip = new JSZip();
            const folder = zip.folder("reference-images");

            // Fetch all images via Vite proxy (relative path)
            const imagePromises = REF_IMAGES.map(async (path, i) => {
                // Use relative path - Vite proxy handles routing to backend
                const response = await fetch(path);
                if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
                const blob = await response.blob();
                const filename = path.split('/').pop() || `reference-${i}.png`;
                folder?.file(filename, blob);
            });

            await Promise.all(imagePromises);

            // Generate and save zip
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "style-references.zip");
        } catch (e) {
            console.error("Failed to zip images", e);
        }
    };

    const handleCopy = async () => {
        try {
            // Helper to fetch and convert image to base64
            const toBase64 = async (url: string): Promise<string> => {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            };

            // Fetch all images and convert to base64
            const imagePromises = REF_IMAGES.map(async (img) => {
                try {
                    // Use relative path - Vite proxy handles routing to backend
                    const base64 = await toBase64(img);
                    return `<img src="${base64}" alt="Reference Style" style="max-width: 500px; display: block; margin-bottom: 10px;" />`;
                } catch (e) {
                    console.error("Failed to load image for clipboard", img, e);
                    return ''; // Skip failed images
                }
            });

            const imageTags = await Promise.all(imagePromises);

            // Create HTML content with embedded base64 images
            const htmlContent = `
                <div>
                    <p style="white-space: pre-wrap;">${editedPrompt}</p>
                    <br/>
                    <h3>Visual References</h3>
                    ${imageTags.join('')}
                </div>
            `;

            // Use Clipboard API for rich content
            if (navigator.clipboard && navigator.clipboard.write) {
                const textBlob = new Blob([editedPrompt], { type: 'text/plain' });
                const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': textBlob,
                        'text/html': htmlBlob
                    })
                ]);
            } else {
                // Fallback
                await navigator.clipboard.writeText(editedPrompt);
            }

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            // Fallback for simple text
            navigator.clipboard.writeText(editedPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleRegenerate();
        }
    };

    const handleGenerateImage = async () => {
        await generateImage(editedPrompt);
        navigate('/reveal');
    };

    const tier = getScoreTier(totalScore);
    const accuracy = Math.min(100, (totalScore / 1000) * 100);

    // Using inline styles for explicit height control
    const containerHeight = 'calc(100vh - 100px)';
    // Increased height for manifest
    const manifestHeight = 'calc(100vh - 200px)';

    return (
        <div style={{ height: containerHeight }} className="prompt-curation war-room-bg">
            {/* Transition Overlay */}
            {isLoading && (
                <div className="prompt-curation__overlay">
                    <div className="prompt-curation__vectors">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="prompt-curation__vector" />
                        ))}
                    </div>

                    <div className="prompt-curation__overlay-content">
                        <div className="prompt-curation__overlay-icon">
                            <Icons.Sparkles />
                        </div>

                        <div className="prompt-curation__overlay-title-wrap">
                            <h2 className="prompt-curation__overlay-title">Synthesizing Vision</h2>
                            <div className="prompt-curation__overlay-subtitle">Neural Engine V3 // ACTIVE</div>
                        </div>

                        <div className="prompt-curation__loading-bar-container">
                            <div className="prompt-curation__loading-bar" />
                            <div className="prompt-curation__loading-glow" />
                        </div>

                        <div className="prompt-curation__status-ticker">
                            <div className="prompt-curation__ticker-label">STATUS_TRACE:</div>
                            <div className="prompt-curation__ticker-text">{LOADING_STATUSES[statusIndex]}</div>
                        </div>


                    </div>
                </div>
            )}

            {/* Main Container */}
            <div className="prompt-curation__container">

                {/* Two Column Layout */}
                <div className="prompt-curation__layout">

                    {/* LEFT COLUMN: 75% */}
                    <div className="prompt-curation__left">

                        {/* Manifest Editor */}
                        <div
                            style={{ height: manifestHeight }}
                            className="prompt-curation__manifest glass-card"
                        >
                            {/* Header */}
                            <div className="prompt-curation__manifest-header">
                                <div className="prompt-curation__manifest-title">
                                    <div className="prompt-curation__manifest-dot" />
                                    <h2 className="prompt-curation__manifest-label">Image Manifest</h2>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="prompt-curation__copy-btn"
                                >
                                    {copied ? <Icons.Check /> : <Icons.Copy />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>

                            {/* Textarea */}
                            <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="prompt-curation__textarea custom-scrollbar"
                                placeholder="Your curated image prompt will appear here..."
                                disabled={isRegenerating}
                            />
                        </div>

                        {/* References Row */}
                        <div className="prompt-curation__ref-row" style={{ display: 'flex', gap: '1rem', height: '100px' }}>
                            <div className="prompt-curation__references glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '1rem', overflowX: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '80px', marginRight: '0.5rem' }}>
                                    <div className="prompt-curation__info-label">Style Refs:</div>
                                    <button
                                        onClick={handleDownloadImages}
                                        className="prompt-curation__copy-btn"
                                        style={{ fontSize: '10px', padding: '4px 8px', justifyContent: 'center', width: 'fit-content' }}
                                        title="Download All References as ZIP"
                                    >
                                        <Icons.Download /> ZIP
                                    </button>
                                </div>
                                {REF_IMAGES.map((img, i) => (
                                    <img
                                        key={i}
                                        src={img}
                                        alt={`Ref ${i}`}
                                        style={{ height: '80px', borderRadius: '4px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                                        onClick={() => window.open(img, '_blank')}
                                        title="Click to view full size"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Refinement Input */}
                        <div className="prompt-curation__refinement glass-card" style={{ marginTop: '0' }}>
                            <div className="prompt-curation__refinement-row">
                                <input
                                    type="text"
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Refine: 'cinematic', 'neon glow', 'abstract'..."
                                    className="prompt-curation__refinement-input"
                                    disabled={isRegenerating}
                                />
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating || !additionalNotes.trim()}
                                    className="prompt-curation__refine-btn btn-secondary"
                                >
                                    {isRegenerating ? <div className="prompt-curation__refine-spinner loading-spinner" /> : <Icons.Refresh />}
                                    <span>{isRegenerating ? '...' : 'Refine'}</span>
                                </button>
                            </div>

                            {conversationHistory.length > 0 && (
                                <div className="prompt-curation__history">
                                    {[...conversationHistory.filter(m => m.role === 'user')].reverse().slice(0, 5).map((msg, i) => (
                                        <div key={i} className="prompt-curation__history-tag">
                                            <Icons.Zap /> <span>{msg.content}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: 25% */}
                    <div style={{ height: containerHeight }} className="prompt-curation__right">

                        {/* Status Card */}
                        <div className="prompt-curation__status glass-card">
                            <div className="prompt-curation__status-row">
                                <div className="prompt-curation__unit-info">
                                    <div className="prompt-curation__info-label">Team</div>
                                    <div className="prompt-curation__unit-value">{session.team_id}</div>
                                </div>
                                <div className="prompt-curation__score-info">
                                    <div className="prompt-curation__info-label">Score</div>
                                    <div className="prompt-curation__score-value">
                                        {totalScore.toFixed(0)} <span className="prompt-curation__score-max">/1000</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Analytics Card */}
                        <div className="prompt-curation__analytics glass-card">
                            <div className="prompt-curation__analytics-header">
                                <h3 className="prompt-curation__analytics-title">Performance</h3>
                                <div className="prompt-curation__live-badge">LIVE</div>
                            </div>

                            <div className="prompt-curation__phase-list custom-scrollbar">
                                {Object.entries(session.phase_scores).map(([name, score]) => {
                                    let maxScore = 0;
                                    const n = name.toLowerCase();
                                    if (n.includes("problem")) maxScore = 250;
                                    else if (n.includes("solution")) maxScore = 350;
                                    else if (n.includes("market")) maxScore = 400;
                                    else maxScore = 333;

                                    return (
                                        <div key={name} className="prompt-curation__phase-item">
                                            <div className="prompt-curation__phase-row">
                                                <span className="prompt-curation__phase-name">{name}</span>
                                                <span className="prompt-curation__phase-score">
                                                    {score.toFixed(0)} <span className="prompt-curation__phase-max">/ {maxScore}</span>
                                                </span>
                                            </div>
                                            <div className="prompt-curation__phase-bar">
                                                <div
                                                    className="prompt-curation__phase-fill"
                                                    style={{ width: `${Math.min((score / maxScore) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary Stats */}
                            <div className="prompt-curation__summary">
                                <div className="prompt-curation__summary-stat">
                                    <div className="prompt-curation__summary-label">Accuracy</div>
                                    <div className="prompt-curation__summary-value prompt-curation__summary-value--success">{accuracy.toFixed(0)}%</div>
                                </div>
                                <div className="prompt-curation__summary-stat">
                                    <div className="prompt-curation__summary-label">Tier</div>
                                    <div className={`prompt-curation__summary-value ${tier.colorClass}`}>{tier.label}</div>
                                </div>
                                <div className="prompt-curation__summary-stat">
                                    <div className="prompt-curation__summary-label">AI Tokens</div>
                                    <div className="prompt-curation__summary-value">
                                        {totalTokens.total}
                                    </div>
                                </div>
                            </div>

                            {/* Penalty Breakdown */}
                            <div className="prompt-curation__penalties">
                                <div className="prompt-curation__penalty-header">MODIFIER BREAKDOWN</div>
                                <div className="prompt-curation__penalty-list">
                                    <div className="prompt-curation__penalty-item">
                                        <span className="prompt-curation__penalty-name">Time Penalty</span>
                                        <span className="prompt-curation__penalty-val text-warning">-{Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.time_penalty || 0), 0))} <span className="text-dim">PTS</span></span>
                                    </div>
                                    <div className="prompt-curation__penalty-item">
                                        <span className="prompt-curation__penalty-name">Hint Usage</span>
                                        <span className="prompt-curation__penalty-val text-error">-{Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.hint_penalty || 0), 0))} <span className="text-dim">PTS</span></span>
                                    </div>
                                    <div className="prompt-curation__penalty-item">
                                        <span className="prompt-curation__penalty-name">Efficiency Bonus</span>
                                        <span className="prompt-curation__penalty-val text-success">+{Math.round(Object.values(session.phases).reduce((acc, p) => acc + (p.metrics?.efficiency_bonus || 0), 0))} <span className="text-dim">PTS</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Finalize Button */}
                        <button
                            onClick={handleGenerateImage}
                            disabled={isLoading || !(typeof editedPrompt === 'string' && editedPrompt.trim()) || isRegenerating}
                            className="prompt-curation__finalize-btn btn-primary"
                        >
                            {isLoading ? (
                                <>
                                    <div className="prompt-curation__finalize-spinner loading-spinner" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Icons.Sparkles />
                                    <span>Finalize Pitch</span>
                                    <Icons.ChevronRight />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
