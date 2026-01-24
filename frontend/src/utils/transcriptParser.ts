/**
 * Brand Dictionary - Maps common misheard variations to correct brand names
 */
const BRAND_DICTIONARY: Record<string, string> = {
    'e g': 'EG',
    'eg': 'EG',
    'inner g': 'EG',
    'e.g.': 'EG',
    'pitch sink': 'PitchSync',
    'pitch sync': 'PitchSync',
    'pitch think': 'PitchSync',
    'claude': 'Claude',
    'bedrock': 'Bedrock',
    'aws': 'AWS',
};

/**
 * Applies brand dictionary corrections to text
 */
const applyBrandCorrections = (text: string): string => {
    let corrected = text;

    // Case-insensitive replacement
    Object.entries(BRAND_DICTIONARY).forEach(([wrong, correct]) => {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        corrected = corrected.replace(regex, correct);
    });

    return corrected;
};

/**
 * Adds smart punctuation based on sentence structure
 */
const addSmartPunctuation = (text: string): string => {
    if (!text.trim()) return text;

    let processed = text.trim();

    // Add period at the end if missing terminal punctuation
    if (!/[.!?]$/.test(processed)) {
        // Check if it looks like a complete sentence (has verb indicators)
        const hasVerbIndicators = /\b(is|are|was|were|will|would|can|could|should|have|has|had)\b/i.test(processed);
        if (hasVerbIndicators && processed.split(' ').length > 3) {
            processed += '.';
        }
    }

    // Capitalize first letter
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);

    // Add commas after common transition words
    processed = processed.replace(/\b(however|therefore|moreover|furthermore|additionally|meanwhile)\s/gi, (match) => {
        return match.trim() + ', ';
    });

    return processed;
};

/**
 * Cleans and normalizes transcript text with brand corrections
 */
export const normalizeTranscript = (text: string): string => {
    let normalized = text.trim();
    normalized = applyBrandCorrections(normalized);
    normalized = addSmartPunctuation(normalized);
    return normalized;
};

/**
 * Appends new transcript segment with intelligent spacing and punctuation
 */
export const appendTranscript = (original: string, addition: string, pauseDuration?: number): string => {
    if (!addition.trim()) return original;

    const hasTrailingNewline = original.endsWith('\n');
    const cleanedOriginal = hasTrailingNewline ? original : original.trim();
    let cleanedAddition = addition.trim();

    // Apply brand corrections to the new addition
    cleanedAddition = applyBrandCorrections(cleanedAddition);

    if (!cleanedOriginal.trim()) {
        return addSmartPunctuation(cleanedAddition);
    }

    // If it already ends with a newline, we don't want to prepend a space
    if (hasTrailingNewline) {
        // Ensure the addition starts with a capital letter if it's following a newline (new paragraph)
        cleanedAddition = cleanedAddition.charAt(0).toUpperCase() + cleanedAddition.slice(1);
        return `${cleanedOriginal}${cleanedAddition}`;
    }

    // Determine separator based on context
    let separator = ' ';

    // If pause was long (>1.5s), treat as new sentence
    if (pauseDuration && pauseDuration > 1500) {
        if (!/[.!?]$/.test(cleanedOriginal.trim())) {
            separator = '. ';
        } else {
            separator = ' ';
        }
        // Capitalize first letter of new sentence
        cleanedAddition = cleanedAddition.charAt(0).toUpperCase() + cleanedAddition.slice(1);
    } else if (/[.!?]$/.test(cleanedOriginal.trim())) {
        // Previous sentence ended with punctuation
        separator = ' ';
        cleanedAddition = cleanedAddition.charAt(0).toUpperCase() + cleanedAddition.slice(1);
    }

    return `${cleanedOriginal}${separator}${cleanedAddition}`;
};
