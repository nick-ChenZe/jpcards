import {describe, expect, it} from 'vitest';
import {toSentenceWithKanjiRomaji} from '../romaji.js';

describe('romaji utility', () => {
    it('adds ruby with romaji only for kanji', async () => {
        const result = await toSentenceWithKanjiRomaji('今日は良い天気です。');
        expect(result).toContain('<ruby>');
        expect(result).toContain('<rt>');
        expect(result).toContain('今日');
        expect(result).toContain('kyou');
        expect(result).toContain('良い');
        expect(result).toContain('天気');
        expect(result).not.toContain('<ruby>です</ruby>');
    });

    it('handles pure kana without ruby', async () => {
        const result = await toSentenceWithKanjiRomaji('こんにちは');
        expect(result).toBe('こんにちは');
        expect(result).not.toContain('<ruby>');
    });
});
