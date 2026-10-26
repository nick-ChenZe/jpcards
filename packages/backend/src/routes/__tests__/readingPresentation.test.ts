import {describe, expect, it} from 'vitest';
import {kanaReading, readingWords} from '../../../../frontend/src/lib/readingPresentation';

describe('single annotated sentence', () => {
    const words = [
        {surface: '昨日', reading: 'きのう', moraWeight: 3},
        {surface: 'は', reading: 'は', moraWeight: 1},
        {surface: '雨。', reading: 'あめ。', moraWeight: 2}
    ];
    it('keeps the complete sentence and only annotates words that need a reading', () => {
        const rendered = readingWords('<ruby>昨日<rt>kinou</rt></ruby>は<ruby>雨<rt>ame</rt></ruby>。', words);
        expect(rendered?.map(word => word.surface).join('')).toBe('昨日は雨。');
        expect(rendered?.map(word => word.annotation)).toEqual(['きのう', '', 'あめ']);
    });
    it('keeps the stored sentence when old tokens are incomplete or mismatched', () => {
        expect(readingWords('昨日は晴れ。', words)).toBeNull();
        expect(readingWords('昨日は雨。', words.slice(1))).toBeNull();
        expect(readingWords('昨日は雨。', null)).toBeNull();
    });
    it('does not invent a pronunciation when an old card only stores surfaces', () => {
        expect(readingWords(undefined, [{surface: '東京', moraWeight: 2}])?.[0].annotation).toBe('');
        expect(readingWords(undefined, [{surface: '東京', reading: '東京', moraWeight: 2}])?.[0].annotation).toBe('');
    });
    it('shows only kana in the reading-only fallback instead of repeating romanization', () => {
        expect(kanaReading('きのうはあめ。（kinou wa ame.）')).toBe('きのうはあめ。');
        expect(kanaReading('こんにちは (konnichiwa)')).toBe('こんにちは');
        expect(kanaReading(undefined)).toBe('');
    });
});
