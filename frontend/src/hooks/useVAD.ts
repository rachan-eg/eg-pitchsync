import { useState, useEffect, useRef, useCallback } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

interface UseVADProps {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onVADMisfire?: () => void;
}

export const useVAD = ({ onSpeechStart, onSpeechEnd, onVADMisfire }: UseVADProps) => {
    const [isActive, setIsActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const vadRef = useRef<MicVAD | null>(null);
    const lastSpeechTimeRef = useRef<number>(0);

    const start = useCallback(async () => {
        if (vadRef.current) return;

        try {
            const vad = await MicVAD.new({
                onSpeechStart: () => {
                    console.log('[VAD] Speech detected');
                    setIsSpeaking(true);
                    lastSpeechTimeRef.current = Date.now();
                    onSpeechStart?.();
                },
                onSpeechEnd: () => {
                    console.log('[VAD] Speech ended');
                    setIsSpeaking(false);
                    onSpeechEnd?.();
                },
                onVADMisfire: () => {
                    console.log('[VAD] Misfire (false positive)');
                    onVADMisfire?.();
                },
                // Tuning parameters for better accuracy
                positiveSpeechThreshold: 0.8, // Higher = more confident speech detection
                negativeSpeechThreshold: 0.5, // Lower = faster end detection
                redemptionMs: 160, // Milliseconds to wait before confirming speech end
                preSpeechPadMs: 20, // Milliseconds to include before speech
                minSpeechMs: 80, // Minimum milliseconds to consider as speech
            });

            vadRef.current = vad;
            vad.start();
            setIsActive(true);
        } catch (error) {
            console.error('[VAD] Failed to initialize:', error);
        }
    }, [onSpeechStart, onSpeechEnd, onVADMisfire]);

    const stop = useCallback(async () => {
        if (vadRef.current) {
            await vadRef.current.destroy();
            vadRef.current = null;
            setIsActive(false);
            setIsSpeaking(false);
        }
    }, []);

    const toggle = useCallback(() => {
        if (isActive) {
            stop();
        } else {
            start();
        }
    }, [isActive, start, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vadRef.current) {
                vadRef.current.destroy();
            }
        };
    }, []);

    return {
        isActive,
        isSpeaking,
        start,
        stop,
        toggle,
        timeSinceLastSpeech: () => Date.now() - lastSpeechTimeRef.current,
    };
};
