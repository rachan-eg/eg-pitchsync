import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Theme, SessionState } from '../../types';
import './PromptCuration.css';

// =============================================================================
// TYPES & CONSTANTS
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
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
    ),
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    ),
    Upload: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
    ),
    Zap: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    ),
};

// =============================================================================
// HELPERS
// =============================================================================
const getScoreTier = (score: number): { label: string; colorClass: string } => {
    if (score >= 900) return { label: 'S-TIER', colorClass: 'curate-analytics__stat-value--warning' };
    if (score >= 800) return { label: 'A-TIER', colorClass: 'curate-analytics__stat-value--success' };
    if (score >= 700) return { label: 'B-TIER', colorClass: '' };
    if (score >= 500) return { label: 'C-TIER', colorClass: '' };
    return { label: 'D-TIER', colorClass: '' };
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
    const { regeneratePrompt, submitPitchImage, totalTokens } = useApp();

    const [editedPrompt, setEditedPrompt] = useState(curatedPrompt);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
    const [copied, setCopied] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Cycle loading statuses
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLoading) {
            interval = setInterval(() => {
                setStatusIndex(prev => (prev + 1) % LOADING_STATUSES.length);
            }, 1800);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    // Update prompt when prop changes
    useEffect(() => {
        if (curatedPrompt) {
            let promptStr = typeof curatedPrompt === 'string' ? curatedPrompt : JSON.stringify(curatedPrompt, null, 2);
            try {
                if (promptStr.trim().startsWith('{')) {
                    const parsed = JSON.parse(promptStr);
                    if (parsed.final_combined_prompt) {
                        promptStr = parsed.final_combined_prompt;
                    }
                }
            } catch {
                // Keep raw string
            }
            setEditedPrompt(promptStr);
        }
    }, [curatedPrompt]);

    // Handlers
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
            const imagePromises = REF_IMAGES.map(async (path, i) => {
                const response = await fetch(path);
                if (!response.ok) throw new Error(`Failed to fetch ${path}`);
                const blob = await response.blob();
                const filename = path.split('/').pop() || `reference-${i}.png`;
                folder?.file(filename, blob);
            });
            await Promise.all(imagePromises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "style-references.zip");
        } catch (e) {
            console.error("Failed to zip images", e);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editedPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleRegenerate();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmitPitch = async () => {
        if (!selectedFile) return;
        await submitPitchImage(editedPrompt, selectedFile);
        navigate('/reveal');
    };

    // Computed values
    const tier = getScoreTier(totalScore);
    const accuracy = Math.min(100, (totalScore / 1000) * 100);

    // Get phase max scores
    const getMaxScore = (name: string): number => {
        const n = name.toLowerCase();
        if (n.includes("problem")) return 250;
        if (n.includes("solution")) return 350;
        if (n.includes("market")) return 400;
        return 333;
    };

    // Calculate penalties (clamp negative values to 0 for backwards compat with old speed bonus data)


    return (
        <div className="prompt-curation war-room-bg">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="curate-overlay">
                    <div className="curate-overlay__content">
                        <div className="curate-overlay__icon">
                            <Icons.Sparkles />
                        </div>
                        <div>
                            <h2 className="curate-overlay__title">Synthesizing Vision</h2>
                            <div className="curate-overlay__subtitle">Neural Engine V3 // ACTIVE</div>
                        </div>
                        <div className="curate-overlay__bar">
                            <div className="curate-overlay__bar-fill" />
                        </div>
                        <div className="curate-overlay__status">{LOADING_STATUSES[statusIndex]}</div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="prompt-curation__main">
                <div className="prompt-curation__columns">

                    {/* LEFT COLUMN */}
                    <div className="prompt-curation__col-left">

                        {/* Manifest Editor */}
                        <div className="curate-card curate-manifest">
                            <div className="curate-manifest__header">
                                <div className="curate-manifest__title">
                                    <div className="curate-manifest__dot" />
                                    <h2 className="curate-manifest__label">Image Manifest</h2>
                                </div>
                                <button onClick={handleCopy} className="curate-btn-icon">
                                    {copied ? <Icons.Check /> : <Icons.Copy />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                            <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="curate-manifest__textarea curate-scrollbar"
                                placeholder="Your curated image prompt will appear here..."
                                disabled={isRegenerating}
                            />
                        </div>

                        {/* References Row */}
                        <div className="curate-card curate-refs">
                            <div className="curate-refs__label-group">
                                <div className="curate-refs__label">Style Refs</div>
                                <button onClick={handleDownloadImages} className="curate-btn-icon">
                                    <Icons.Download /> ZIP
                                </button>
                            </div>
                            {REF_IMAGES.map((img, i) => (
                                <img
                                    key={i}
                                    src={img}
                                    alt={`Ref ${i}`}
                                    className="curate-refs__img"
                                    onClick={() => window.open(img, '_blank')}
                                    title="Click to view full size"
                                />
                            ))}
                        </div>

                        {/* Refine Input */}
                        <div className="curate-card curate-refine">
                            <div className="curate-refine__row">
                                <input
                                    type="text"
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Refine: 'cinematic', 'neon glow', 'abstract'..."
                                    className="curate-refine__input"
                                    disabled={isRegenerating}
                                />
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating || !additionalNotes.trim()}
                                    className="curate-refine__btn"
                                >
                                    {isRegenerating ? '...' : <><Icons.Refresh /> Refine</>}
                                </button>
                            </div>
                            {conversationHistory.length > 0 && (
                                <div className="curate-refine__history">
                                    {[...conversationHistory.filter(m => m.role === 'user')].reverse().slice(0, 5).map((msg, i) => (
                                        <div key={i} className="curate-refine__tag">
                                            <Icons.Zap /> <span>{msg.content}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="prompt-curation__col-right">



                        {/* Analytics Card */}
                        <div className="curate-card curate-analytics">
                            <div className="curate-analytics__header">
                                <h3 className="curate-analytics__title">Performance</h3>
                                <div className="curate-analytics__live">LIVE</div>
                            </div>

                            <div className="curate-analytics__phases curate-scrollbar">
                                {Object.entries(session.phase_scores).map(([name, score]) => {
                                    const maxScore = getMaxScore(name);
                                    return (
                                        <div key={name} className="curate-analytics__phase">
                                            <div className="curate-analytics__phase-row">
                                                <span className="curate-analytics__phase-name">{name}</span>
                                                <span className="curate-analytics__phase-score">
                                                    {score.toFixed(0)} <span className="curate-analytics__phase-max">/ {maxScore}</span>
                                                </span>
                                            </div>
                                            <div className="curate-analytics__phase-bar">
                                                <div
                                                    className="curate-analytics__phase-fill"
                                                    style={{ width: `${Math.min((score / maxScore) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="curate-analytics__summary">
                                <div className="curate-analytics__stat">
                                    <div className="curate-analytics__stat-label">Accuracy</div>
                                    <div className={`curate-analytics__stat-value curate-analytics__stat-value--success`}>{accuracy.toFixed(0)}%</div>
                                </div>
                                <div className="curate-analytics__stat">
                                    <div className="curate-analytics__stat-label">Tier</div>
                                    <div className={`curate-analytics__stat-value ${tier.colorClass}`}>{tier.label}</div>
                                </div>
                                <div className="curate-analytics__stat">
                                    <div className="curate-analytics__stat-label">Tokens</div>
                                    <div className="curate-analytics__stat-value">{totalTokens.total}</div>
                                </div>
                            </div>


                        </div>

                        {/* Actions (Upload + Finalize) */}
                        <div className="curate-actions">
                            <div className="curate-card curate-upload">
                                <div className="curate-upload__label">Upload Pitch Visual</div>
                                <p className="curate-upload__instruction">
                                    Copy the prompt above and generate your image using an AI tool, then upload the result here.
                                </p>
                                <div className="curate-tools-row">
                                    <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="curate-provider-btn curate-provider-btn--gemini">
                                        Open Gemini
                                    </a>
                                    <a href="https://chat.openai.com/" target="_blank" rel="noopener noreferrer" className="curate-provider-btn curate-provider-btn--chatgpt">
                                        Open ChatGPT
                                    </a>
                                </div>
                                <input
                                    type="file"
                                    id="pitch-visual-upload"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="curate-upload__input"
                                />
                                <label htmlFor="pitch-visual-upload" className="curate-upload__dropzone">
                                    <div className="curate-upload__icon"><Icons.Upload /></div>
                                    <span className="curate-upload__text">
                                        {selectedFile ? selectedFile.name : "Click to Select Image"}
                                    </span>
                                    <span className="curate-upload__hint">
                                        {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "PNG, JPG up to 10MB"}
                                    </span>
                                </label>
                            </div>

                            <button
                                onClick={handleSubmitPitch}
                                disabled={isLoading || !selectedFile || isRegenerating}
                                className="curate-finalize"
                            >
                                {isLoading ? (
                                    <span>Processing...</span>
                                ) : (
                                    <>
                                        <Icons.Sparkles />
                                        <span>Upload & Finalize</span>
                                        <Icons.ChevronRight />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
