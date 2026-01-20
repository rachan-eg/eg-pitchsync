import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../AppContext';
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
    ArrowLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    )
};

// =============================================================================
// HELPERS
// =============================================================================


// =============================================================================
// COMPONENT
// =============================================================================
export const PromptCuration: React.FC<PromptCurationProps> = ({
    session,
    curatedPrompt,
    usecaseTitle: _usecaseTitle,
    theme: _theme,
    isLoading
}) => {
    const navigate = useNavigate();
    const { regeneratePrompt, submitPitchImage, uploadedImages, setActiveRevealImage, curatePrompt } = useApp();

    const [editedPrompt, setEditedPrompt] = useState(curatedPrompt);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
    const [copied, setCopied] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

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

    // Check for stale prompt (re-synthesize if phases updated after prompt generation)
    useEffect(() => {
        if (isLoading || isRegenerating || !session) return;

        const checkStaleness = async () => {
            // Get latest phase completion time
            let lastPhaseTime = 0;
            Object.values(session.phases).forEach(p => {
                if (p.status === 'passed' && p.metrics?.end_time) {
                    const t = new Date(p.metrics.end_time).getTime();
                    if (t > lastPhaseTime) lastPhaseTime = t;
                }
            });

            // Get curation time
            const curationTime = session.final_output?.generated_at
                ? new Date(session.final_output.generated_at).getTime()
                : 0;

            // If we have finalized phases AND (no curation OR curation is older than last phase)
            // We use a 5-second buffer to prevent race conditions or clock skews
            if (lastPhaseTime > 0 && (curationTime === 0 || lastPhaseTime > curationTime + 5000)) {
                console.log("Found stale prompt, re-synthesizing...", { lastPhaseTime, curationTime });
                await curatePrompt();
            }
        };

        checkStaleness();
    }, [session, isLoading, isRegenerating, curatePrompt]);

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
        setIsRegenerating(true);
        try {
            if (additionalNotes.trim()) {
                // REFINE MODE - Append to history and refine
                const newHistory = [...conversationHistory, { role: 'user' as const, content: additionalNotes.trim() }];
                await regeneratePrompt(additionalNotes.trim(), newHistory);
                setConversationHistory([...newHistory, { role: 'assistant' as const, content: 'Applied' }]);
                setAdditionalNotes('');
            } else {
                // REGENERATE MODE - Fresh start from current phase data
                // This resets history and re-synthesizes from scratch
                await curatePrompt();
                setConversationHistory([]);
            }
        } catch (error) {
            console.error('Regeneration failed:', error);
        } finally {
            setIsRegenerating(false);
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
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

    // Drag and Drop handlers
    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadedImages.length < 3) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (uploadedImages.length >= 3) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Validate it's an image
            if (file.type.startsWith('image/')) {
                setSelectedFile(file);
            }
        }
    };

    const handleSubmitPitch = async () => {
        if (!selectedFile) return;
        await submitPitchImage(editedPrompt, selectedFile);
        navigate('/reveal');
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
                {/* Header */}
                <header className="curate-header animate-slideUp">
                    <div className="curate-header__left">
                        <button className="curate-back-btn btn-secondary" onClick={() => navigate('/war-room')}>
                            <Icons.ArrowLeft /> BACK TO PHASES
                        </button>
                    </div>
                    <div className="curate-header__title-group">
                        <span className="curate-header__subtitle">Synthesis</span>
                        <h1 className="curate-header__title">Prompt Curation</h1>
                    </div>
                    <div className="curate-header__right" />
                </header>

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


                        {/* Refine Input */}
                        <div className="curate-card curate-refine">
                            <div className="curate-refine__row">
                                <input
                                    type="text"
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Refine: 'cinematic', 'neon glow', 'abstract'..."
                                    className="curate-refine__input"
                                    disabled={isRegenerating}
                                />
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating}
                                    className="curate-refine__btn"
                                >
                                    {isRegenerating ? '...' : (
                                        <>{additionalNotes.trim() ? <Icons.Zap /> : <Icons.Refresh />} {additionalNotes.trim() ? 'Refine' : 'Regenerate'}</>
                                    )}
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

                        {/* Previous Submissions Gallery */}
                        <div className="curate-card curate-gallery">
                            <div className="curate-gallery__header">
                                <h3 className="curate-gallery__title">Previous Submissions</h3>
                                <div className="curate-gallery__badge">
                                    {uploadedImages.length}/3
                                </div>
                            </div>

                            {uploadedImages.length > 0 ? (
                                <div className="curate-gallery__grid">
                                    {uploadedImages.map((img, i) => (
                                        <div
                                            key={i}
                                            className="curate-gallery__item"
                                            onClick={() => {
                                                setActiveRevealImage(img);
                                                navigate('/reveal');
                                            }}
                                        >
                                            <img
                                                src={img}
                                                alt={`Submission ${i + 1}`}
                                                className="curate-gallery__image"
                                            />
                                            <div className="curate-gallery__overlay">
                                                <span className="curate-gallery__number">#{i + 1}</span>
                                                <span className="curate-gallery__action">View Full</span>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Empty slots */}
                                    {Array.from({ length: 3 - uploadedImages.length }).map((_, i) => (
                                        <div key={`empty-${i}`} className="curate-gallery__item curate-gallery__item--empty">
                                            <div className="curate-gallery__empty-content">
                                                <span className="curate-gallery__empty-number">#{uploadedImages.length + i + 1}</span>
                                                <span className="curate-gallery__empty-text">Awaiting</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="curate-gallery__empty-state">
                                    <div className="curate-gallery__empty-icon">
                                        <Icons.Upload />
                                    </div>
                                    <p className="curate-gallery__empty-message">No submissions yet</p>
                                    <p className="curate-gallery__empty-hint">Upload your first pitch visual below</p>
                                </div>
                            )}
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
                                    disabled={uploadedImages.length >= 3}
                                />
                                <label
                                    htmlFor="pitch-visual-upload"
                                    className={`curate-upload__dropzone ${uploadedImages.length >= 3 ? 'curate-upload__dropzone--frozen' : ''} ${isDragging ? 'curate-upload__dropzone--dragging' : ''}`}
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <div className="curate-upload__icon"><Icons.Upload /></div>
                                    <span className="curate-upload__text">
                                        {isDragging ? "Drop image here" : selectedFile ? selectedFile.name : "Click or Drag & Drop Image"}
                                    </span>
                                    <span className="curate-upload__hint">
                                        {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "PNG, JPG up to 20MB"}
                                    </span>
                                </label>
                            </div>

                            <button
                                onClick={handleSubmitPitch}
                                disabled={isLoading || !selectedFile || isRegenerating || uploadedImages.length >= 3}
                                className={`curate-finalize ${uploadedImages.length >= 3 ? 'curate-finalize--frozen' : ''}`}
                                data-tooltip={uploadedImages.length >= 3 ? "Max limit reached" : ""}
                            >
                                {isLoading ? (
                                    <span>Processing...</span>
                                ) : (
                                    <>
                                        <Icons.Sparkles />
                                        <span>{uploadedImages.length >= 3 ? "Max Limit Reached" : "Upload & Finalize"}</span>
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
