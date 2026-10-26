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
