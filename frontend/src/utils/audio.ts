/**
 * Audio Utilities for Sound Effects
 * Uses Web Audio API to generate UI sounds without external assets
 */

export const playBroadcastSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();

        // Master Gain
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.2; // Keep it subtle
        masterGain.connect(ctx.destination);

        // Oscillator 1 (Main Tone)
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc1.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Ramp up to A6

        const gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        osc1.connect(gain1);
        gain1.connect(masterGain);

        // Oscillator 2 (Harmonic Overlay)
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1760, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(2200, ctx.currentTime + 0.1);

        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        osc2.connect(gain2);
        gain2.connect(masterGain);

        // Play
        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);

        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);

    } catch (e) {
        console.error('Failed to play broadcast sound', e);
    }
};

export const playBroadcastReceivedSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();

        // Master Gain
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);

        // Sequence: High Blink (E6) then Drop
        // Play two short blips
        const now = ctx.currentTime;

        [0, 0.15].forEach(offset => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1318.51, now + offset); // E6
            osc.frequency.exponentialRampToValueAtTime(659.25, now + offset + 0.1); // E5

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(1, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + offset);
            osc.stop(now + offset + 0.15);
        });

    } catch (e) {
        console.error('Failed to play broadcast received sound', e);
    }
};
