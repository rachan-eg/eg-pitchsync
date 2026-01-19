import { useState, useCallback, useRef, useEffect } from 'react';
import { isSTTSupported } from '../utils/browserSupportCheck';

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'error';

interface UseVoiceInputProps {
    onFinalSegment: (text: string, pauseDuration?: number) => void;
    onInterimSegment?: (text: string) => void;
    lang?: string;
}

export const useVoiceInput = ({ onFinalSegment, onInterimSegment, lang = 'en-IN' }: UseVoiceInputProps) => {
    const [state, setState] = useState<VoiceState>(isSTTSupported() ? 'idle' : 'error');
    const [error, setError] = useState<string | null>(null);
    const [volume, setVolume] = useState(0);

    // Refs
    const stateRef = useRef<VoiceState>('idle');
    const onFinalSegmentRef = useRef(onFinalSegment);
    const onInterimSegmentRef = useRef(onInterimSegment);
    const recognitionRef = useRef<any>(null);
    const shouldBeListeningRef = useRef(false);
    const noSpeechCountRef = useRef(0);
    const lastSpeechTimeRef = useRef<number>(0);
    const lastTranscriptTimeRef = useRef<number>(0);

    // Audio Context
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const volumeAnimRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        onFinalSegmentRef.current = onFinalSegment;
        onInterimSegmentRef.current = onInterimSegment;
    }, [onFinalSegment, onInterimSegment]);

    const stopAudioAnalysis = () => {
        if (volumeAnimRef.current) cancelAnimationFrame(volumeAnimRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        setVolume(0);
    };

    const startAudioAnalysis = async () => {
        // If we are no longer listening by the time this fires (due to delay), abort.
        if (!shouldBeListeningRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    autoGainControl: true,
                    noiseSuppression: false,
                    echoCancellation: true
                }
            });

            // Double check acceptance
            if (!shouldBeListeningRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            const updateVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                setVolume(Math.min(1, (average / 64)));
                volumeAnimRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
        } catch (err) {
            console.warn('Volume analysis failed:', err);
        }
    };

    const stop = useCallback(() => {
        shouldBeListeningRef.current = false;
        stopAudioAnalysis();

        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.onend = null;
                recognition.stop();
            } catch (e) { }
        }
        setState('idle');
    }, []);

    const start = useCallback(() => {
        if (stateRef.current === 'listening' || stateRef.current === 'requesting') return;

        setError(null);
        shouldBeListeningRef.current = true;
        noSpeechCountRef.current = 0;
        lastSpeechTimeRef.current = Date.now();
        setState('requesting');

        const initiateRecognition = () => {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = lang;

            recognition.onstart = () => {
                if (shouldBeListeningRef.current) {
                    setState('listening');
                }
            };

            recognition.onresult = (event: any) => {
                noSpeechCountRef.current = 0;
                lastSpeechTimeRef.current = Date.now();
                setError(null);

                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        // Calculate pause duration since last transcript
                        const now = Date.now();
                        const pauseDuration = lastTranscriptTimeRef.current > 0
                            ? now - lastTranscriptTimeRef.current
                            : 0;
                        lastTranscriptTimeRef.current = now;

                        if (onFinalSegmentRef.current) {
                            onFinalSegmentRef.current(result[0].transcript, pauseDuration);
                        }
                    } else {
                        interim += result[0].transcript;
                    }
                }
                if (onInterimSegmentRef.current) onInterimSegmentRef.current(interim);
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'no-speech') {
                    noSpeechCountRef.current += 1;
                    if (noSpeechCountRef.current > 3) setError('Try speaking closer or louder.');
                } else if (event.error !== 'aborted') {
                    // Ignore some errors if we are restarting
                    if (event.error !== 'network') setError(`Sync: ${event.error}`);
                }
            };

            recognition.onend = () => {
                recognitionRef.current = null;
                if (shouldBeListeningRef.current) {
                    setTimeout(() => {
                        if (shouldBeListeningRef.current) initiateRecognition();
                    }, 100);
                }
            };

            recognitionRef.current = recognition;
            try {
                recognition.start();
            } catch (e) {
                if (shouldBeListeningRef.current) setState('error');
            }
        };

        // START STT IMMEDIATELY
        initiateRecognition();

        // DELAY VISUALIZER (Hardware Access)
        setTimeout(() => {
            if (shouldBeListeningRef.current) startAudioAnalysis();
        }, 600);

    }, [lang, stop]);

    const toggle = useCallback(() => {
        if (shouldBeListeningRef.current) stop(); else start();
    }, [start, stop]);

    useEffect(() => {
        return () => {
            shouldBeListeningRef.current = false;
            stopAudioAnalysis();
            if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { }
        };
    }, []);

    return {
        state: (state === 'listening' || (state === 'requesting' && shouldBeListeningRef.current)) ? 'listening' : state,
        error,
        volume,
        start,
        stop,
        toggle
    };
};
