import {describe, expect, it} from 'vitest';
import {pickPracticeCard, readingForSentence} from '../practiceDeck.js';

describe('pickPracticeCard', () => {
    it('walks the local deck without repeating a sentence the user already has', () => {
        const first = pickPracticeCard([]);
        const second = pickPracticeCard([first.sentence]);
        expect(first.gloss.length).toBeGreaterThan(0);
        expect(first.reading.length).toBeGreaterThan(0);
        expect(second.sentence).not.toBe(first.sentence);
        expect(readingForSentence(first.sentence)).toBe(first.reading);
        expect(readingForSentence('未知的句子')).toBe('');
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
