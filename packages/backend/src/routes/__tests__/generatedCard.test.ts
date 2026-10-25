import {describe, expect, it} from 'vitest';
import {parseGeneratedCard} from '../generatedCard.js';

describe('parseGeneratedCard', () => {
    it('reads sentence, kana and gloss from JSON', () => {
        const parsed = parseGeneratedCard(
            '{"sentence":"水を飲みます。","reading":"みずをのみます。","gloss":"我喝水。"}'
        );
        expect(parsed).toEqual({
            sentence: '水を飲みます。',
            reading: 'みずをのみます。',
            gloss: '我喝水。'
        });
    });

    it('accepts a fenced JSON object', () => {
        const parsed = parseGeneratedCard(
            '```json\n{"sentence":"こんにちは。","reading":"こんにちは。","gloss":"你好。"}\n```'
        );
        expect(parsed.sentence).toBe('こんにちは。');
        expect(parsed.gloss).toBe('你好。');
    });

    it('keeps a plain sentence when the model ignores JSON', () => {
        expect(parseGeneratedCard('こんにちは。')).toEqual({
            sentence: 'こんにちは。',
            gloss: '',
            reading: ''
        });
    });

    it('drops a gloss that is not Chinese', () => {
        const parsed = parseGeneratedCard('{"sentence":"こんにちは。","reading":"こんにちは。","gloss":"hello"}');
        expect(parsed.gloss).toBe('');
    });
});
