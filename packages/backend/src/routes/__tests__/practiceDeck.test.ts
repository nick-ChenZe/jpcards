import {describe, expect, it} from 'vitest';
import {pickPracticeCard, readingForSentence} from '../practiceDeck.js';

describe('pickPracticeCard', () => {
    it('walks the local deck without repeating a sentence the user already has', () => {
        const first = pickPracticeCard([]);
        const second = pickPracticeCard([first.sentence]);
        expect(first.gloss.length).toBeGreaterThan(0);
        expect(first.reading).toBe('こんにちは（konnichiwa）');
        expect(second.sentence).not.toBe(first.sentence);
        expect(second.reading).toBe('ありがとうございます（arigatou gozaimasu）');
        expect(readingForSentence(first.sentence)).toBe(first.reading);
        expect(readingForSentence('未知的句子')).toBe('');
        expect(first.reading).toMatch(/^[\u3040-\u30ff]/);
        expect(second.reading).toMatch(/^[\u3040-\u30ff]/);
    });

    it('cycles after every local sentence has been seen', () => {
        const seen = [
            'こんにちは。',
            'ありがとうございます。',
            'これは本です。',
            '水を飲みます。',
            '今日はいい天気です。'
        ];
        expect(pickPracticeCard(seen).sentence).toBe('こんにちは。');
    });
});
