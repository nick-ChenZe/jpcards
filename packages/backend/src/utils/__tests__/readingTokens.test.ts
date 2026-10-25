import {describe, expect, it} from 'vitest';
import {
    activeTokenIndex,
    moraWeightOf,
    parseStoredReadingTokens,
    playbackTokenIndex,
    readingLineParts,
    serializeReadingTokens,
    splitSentenceHtml
} from '../readingHighlight.js';
import {shapeReadingTokens, toReadingTokens} from '../readingTokens.js';
import {toDisplayReading, toSentenceWithKanjiRomaji} from '../romaji.js';

describe('reading token mora weights', () => {
    it('counts kana and long vowels, and does not count youon or punctuation', () => {
        expect(moraWeightOf('きょう')).toBe(2);
        expect(moraWeightOf('きょ')).toBe(1);
        expect(moraWeightOf('コーヒー')).toBe(4);
        expect(moraWeightOf('がっこう')).toBe(4);
        expect(moraWeightOf('こんにちは')).toBe(5);
        expect(moraWeightOf('。、！？ ')).toBe(0);
    });

    it('shapes dictionary readings and merges punctuation into the adjacent token', () => {
        expect(shapeReadingTokens([
            {surface_form: '今日', reading: 'キョウ'},
            {surface_form: 'は', reading: 'ハ'},
            {surface_form: '。', reading: '。'}
        ])).toEqual([
            {surface: '今日', reading: 'きょう', moraWeight: 2},
            {surface: 'は。', reading: 'は。', moraWeight: 1}
        ]);

        expect(shapeReadingTokens([
            {surface_form: '「', reading: '「'},
            {surface_form: 'コーヒー', reading: 'コーヒー'},
            {surface_form: '」', reading: '」'}
        ])).toEqual([
            {surface: '「コーヒー」', reading: '「コーヒー」', moraWeight: 4}
        ]);

        expect(shapeReadingTokens([
            {surface_form: '学校', reading: 'ガッコウ'}
        ])).toEqual([
            {surface: '学校', reading: 'がっこう', moraWeight: 4}
        ]);
    });

    it('keeps a kanji token when the dictionary reading is missing', () => {
        expect(shapeReadingTokens([
            {surface_form: '東京', reading: '*'}
        ])).toEqual([
            {surface: '東京', reading: '東京', moraWeight: 2}
        ]);
    });

    it('allocates the timeline linearly and stays quiet without a duration', () => {
        const tokens = [
            {surface: '今', moraWeight: 1},
            {surface: '日', moraWeight: 1},
            {surface: 'は', moraWeight: 2}
        ];
        expect(activeTokenIndex(tokens, 0, 4)).toBe(0);
        expect(activeTokenIndex(tokens, 0.9, 4)).toBe(0);
        expect(activeTokenIndex(tokens, 1, 4)).toBe(1);
        expect(activeTokenIndex(tokens, 2, 4)).toBe(2);
        expect(activeTokenIndex(tokens, 4, 4)).toBe(2);
        expect(activeTokenIndex(tokens, 0, 0)).toBeNull();
        expect(activeTokenIndex(tokens, 0, Number.NaN)).toBeNull();
        expect(activeTokenIndex([{moraWeight: 0}], 0.2, 3)).toBeNull();
        expect(playbackTokenIndex(tokens, 0, 4, false, false)).toBeNull();
        expect(playbackTokenIndex(tokens, 0, 4, true, false)).toBe(0);
        expect(playbackTokenIndex(tokens, 1.2, 4, false, false)).toBe(1);
        expect(playbackTokenIndex(tokens, 4, 4, false, true)).toBeNull();
        expect(playbackTokenIndex(null, 1, 4, true, false)).toBeNull();
    });

    it('splits sentence html on token surfaces and keeps ruby', () => {
        expect(splitSentenceHtml(
            '<ruby>水<rt>mizu</rt></ruby>を飲みます。',
            ['水', 'を', '飲みます。']
        )).toEqual([
            '<ruby>水<rt>mizu</rt></ruby>',
            'を',
            '飲みます。'
        ]);
        expect(splitSentenceHtml('A&amp;B', ['A&B'])).toEqual(['A&amp;B']);
        expect(splitSentenceHtml('<ruby>水', ['水'])).toBeNull();
        expect(splitSentenceHtml('こんにちは', ['こんばんは'])).toBeNull();
    });

    it('drops invalid stored json instead of throwing', () => {
        const tokens = [{surface: 'は', reading: 'は', moraWeight: 1}];
        expect(parseStoredReadingTokens(serializeReadingTokens(tokens))).toEqual(tokens);
        expect(parseStoredReadingTokens(null)).toBeNull();
        expect(parseStoredReadingTokens('')).toBeNull();
        expect(parseStoredReadingTokens('[]')).toBeNull();
        expect(parseStoredReadingTokens('not-json')).toBeNull();
        expect(parseStoredReadingTokens('[{"surface":"は","moraWeight":"1"}]')).toBeNull();
    });

    it('aligns kuromoji tokens with the sentence, the reading line, and the ruby html', async () => {
        const sentence = '今日はコーヒーを飲みます。';
        const tokens = await toReadingTokens(sentence);
        expect(tokens).not.toBeNull();
        if (!tokens) {
            return;
        }
        expect(tokens.map((token) => token.surface).join('')).toBe(sentence);
        expect(tokens.find((token) => token.surface === '今日')?.moraWeight).toBe(2);
        expect(tokens.find((token) => token.surface === 'コーヒー')?.moraWeight).toBe(4);
        expect(tokens.some((token) => token.surface === '。')).toBe(false);
        expect(tokens.every((token) => token.moraWeight > 0)).toBe(true);

        const reading = await toDisplayReading(sentence);
        const parts = readingLineParts(reading, tokens);
        expect(parts?.parts.join('')).toBe(reading.split('（')[0]);

        const html = await toSentenceWithKanjiRomaji(sentence);
        const segments = splitSentenceHtml(html, tokens.map((token) => token.surface));
        expect(segments?.join('')).toBe(html);

        const school = await toReadingTokens('学校へ行きます。');
        expect(school?.find((token) => token.surface === '学校')?.moraWeight).toBe(4);

        const quoted = await toReadingTokens('「水」を飲みます。');
        expect(quoted?.map((token) => token.surface).join('')).toBe('「水」を飲みます。');
        expect(quoted?.some((token) => token.moraWeight === 0)).toBe(false);
        expect(quoted?.[0]?.surface.startsWith('「')).toBe(true);
    });
});
