/**
 * Text-to-Speech Utility
 * Provides voice feedback for hands-free operation
 */

interface TTSOptions {
    rate?: number;      // 0.1 to 10 (default: 1)
    pitch?: number;     // 0 to 2 (default: 1)
    volume?: number;    // 0 to 1 (default: 1)
    lang?: string;      // BCP 47 language tag (default: 'en-US')
}

class TTSManager {
    private synth: SpeechSynthesis;
    private defaultVoice: SpeechSynthesisVoice | null = null;

    constructor() {
        this.synth = window.speechSynthesis;
        this.initializeVoices();
    }

    private initializeVoices() {
        // Load voices (may be async in some browsers)
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            // Prefer a natural-sounding English voice
            this.defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural'))
                || voices.find(v => v.lang.startsWith('en-US'))
                || voices[0];
        };

        loadVoices();

        // Some browsers fire this event when voices are loaded
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
    }

    /**
     * Speaks the given text with optional configuration
     */
    speak(text: string, options: TTSOptions = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            // Cancel any ongoing speech
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);

            utterance.rate = options.rate ?? 1.1;      // Slightly faster for efficiency
            utterance.pitch = options.pitch ?? 1.0;
            utterance.volume = options.volume ?? 0.8;  // Slightly quieter to not be jarring
            utterance.lang = options.lang ?? 'en-IN';

            if (this.defaultVoice) {
                utterance.voice = this.defaultVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (error) => {
                console.error('[TTS] Error:', error);
                reject(error);
            };

            this.synth.speak(utterance);
        });
    }

    /**
     * Cancels any ongoing speech
     */
    cancel() {
        this.synth.cancel();
    }

    /**
     * Quick confirmation sounds
     */
    async confirm(message: string = 'Confirmed') {
        await this.speak(message, { rate: 1.2, volume: 0.6 });
    }

    async error(message: string = 'Error occurred') {
        await this.speak(message, { rate: 1.0, pitch: 0.8, volume: 0.7 });
    }

    /**
     * Reads back a summary of transcribed text
     */
    async readback(text: string, maxLength: number = 100) {
        let summary = text.trim();

        if (summary.length > maxLength) {
            // Read first sentence or first maxLength characters
            const firstSentence = summary.match(/^[^.!?]+[.!?]/)?.[0];
            summary = firstSentence || summary.substring(0, maxLength) + '...';
        }

        await this.speak(`You said: ${summary}`, { rate: 1.3 });
    }
}

// Singleton instance
let ttsInstance: TTSManager | null = null;

export const getTTS = (): TTSManager => {
    if (!ttsInstance) {
        ttsInstance = new TTSManager();
    }
    return ttsInstance;
};

// Convenience exports
export const speak = (text: string, options?: TTSOptions) => getTTS().speak(text, options);
export const cancelSpeech = () => getTTS().cancel();
export const confirmAudio = (message?: string) => getTTS().confirm(message);
export const errorAudio = (message?: string) => getTTS().error(message);
export const readbackTranscript = (text: string, maxLength?: number) => getTTS().readback(text, maxLength);
