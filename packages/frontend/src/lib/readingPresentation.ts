import {parseReadingTokens, splitSentenceHtml} from './readingHighlight';

/** Only replace the stored sentence when the token surfaces match it exactly. */
export function readingWords (sentenceHtml: string | undefined, value: unknown) {
    const tokens = parseReadingTokens(value);
    if (!tokens || (sentenceHtml && !splitSentenceHtml(sentenceHtml, tokens.map(token => token.surface)))) {
        return null;
    }
    return tokens.map(token => ({
        surface: token.surface,
        // Kana-only words already show their pronunciation; don't repeat it above them.
        annotation: /[\u3400-\u9fff々]/u.test(token.surface) && token.reading && token.reading !== token.surface
            ? token.reading.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
            : ''
    }));
}

export function kanaReading (reading: string | undefined): string {
    return reading?.split(/[（(]/u, 1)[0].trim() ?? '';
}

/** Keep a short auxiliary ending on the same line as its word; retain every playback index. */
export function readingWordGroups (words: ReadonlyArray<{surface: string;}>): number[][] {
    let endStart = words.length - 1;
    const auxiliary = /^(?:です|でし|ます|まし|ませ|た|ない|なかっ|ん|でした|ません)$/u;
    while (endStart > 0 && auxiliary.test(words[endStart].surface.replace(/[\p{P}\s]/gu, ''))) endStart--;
    const tail = words.slice(endStart).map(word => word.surface).join('');
    const keepEnding = endStart < words.length - 1 && Array.from(tail).length <= 8;
    return keepEnding
        ? [
            ...Array.from({length: endStart}, (_, i) => [i]),
            Array.from({length: words.length - endStart}, (_, i) => endStart + i)
        ]
        : words.map((_, i) => [i]);
}
