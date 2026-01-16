/**
 * Cleans and normalizes transcript text.
 * Ensures proper spacing and removals of redundant artifacts if needed.
 */
export const normalizeTranscript = (text: string): string => {
    return text.trim();
};

export const appendTranscript = (original: string, addition: string): string => {
    if (!addition.trim()) return original;
    const cleanedOriginal = original.trim();
    const cleanedAddition = addition.trim();

    if (!cleanedOriginal) return cleanedAddition;

    const separator = cleanedOriginal.endsWith('.') || cleanedOriginal.endsWith('?') || cleanedOriginal.endsWith('!') ? ' ' : ' ';
    return `${cleanedOriginal}${separator}${cleanedAddition}`;
};
