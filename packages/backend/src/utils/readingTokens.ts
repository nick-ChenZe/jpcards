import {toHiragana} from 'wanakana';
import {type DictLoadOptions, loadKuromojiTokenizer} from './kuromojiDict.js';
import {isPunctuationOnly, moraWeightOf, type ReadingToken} from './readingHighlight.js';

const KANJI = /[\u4e00-\u9fff]/;

export interface KuromojiLikeToken {
    surface_form: string;
    reading?: string | null;
    pronunciation?: string | null;
}

function cleanReading (value: string | null | undefined): string {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed === '*') {
        return '';
    }
    return trimmed;
}

/** 和整句读音同一条规则：汉字用词典读音的平假名，表面已是假名时保留原文。 */
function displayKana (surface: string, rawReading: string): string {
    if (KANJI.test(surface) && rawReading) {
        return toHiragana(rawReading);
    }
    return surface;
}

function contentWeight (surface: string, reading: string): number {
    const fromReading = moraWeightOf(reading);
    if (fromReading > 0) {
        return fromReading;
    }
    if (isPunctuationOnly(surface)) {
        return 0;
    }
    let count = 0;
    for (const char of surface) {
        if (!isPunctuationOnly(char)) {
            count += 1;
        }
    }
    return Math.max(count, 1);
}

function mergePunctuation (tokens: ReadingToken[]): ReadingToken[] {
    const merged: ReadingToken[] = [];
    let prefix = '';
    for (const token of tokens) {
        const reading = token.reading ?? token.surface;
        if (token.moraWeight <= 0 && isPunctuationOnly(token.surface)) {
            if (merged.length === 0) {
                prefix += token.surface;
            } else {
                const previous = merged[merged.length - 1];
                merged[merged.length - 1] = {
                    surface: previous.surface + token.surface,
                    reading: `${previous.reading ?? previous.surface}${reading}`,
                    moraWeight: previous.moraWeight
                };
            }
            continue;
        }
        merged.push({
            surface: prefix + token.surface,
            reading: prefix + reading,
            moraWeight: token.moraWeight
        });
        prefix = '';
    }
    if (prefix) {
        merged.push({surface: prefix, reading: prefix, moraWeight: 0});
    }
    return merged;
}

export function shapeReadingTokens (tokens: KuromojiLikeToken[]): ReadingToken[] {
    const shaped: ReadingToken[] = [];
    for (const token of tokens) {
        const surface = token.surface_form ?? '';
        if (!surface) {
            continue;
        }
        const rawReading = cleanReading(token.reading) || cleanReading(token.pronunciation);
        const reading = displayKana(surface, rawReading);
        shaped.push({
            surface,
            reading,
            moraWeight: contentWeight(surface, reading)
        });
    }
    return mergePunctuation(shaped);
}

/**
 * kuromoji 分词成功时返回带 mora 权重的词。词典不可用或分词抛错时返回 null，不向外抛。
 */
export async function toReadingTokens (
    sentence: string,
    options?: DictLoadOptions
): Promise<ReadingToken[] | null> {
    try {
        const tokenizer = await loadKuromojiTokenizer(options ?? {});
        if (!tokenizer) {
            return null;
        }
        const shaped = shapeReadingTokens(tokenizer.tokenize(sentence));
        return shaped.length > 0 ? shaped : null;
    } catch {
        console.error('[reading] tokenize failed');
        return null;
    }
}
