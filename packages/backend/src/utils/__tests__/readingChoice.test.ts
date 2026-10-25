import {describe, expect, it} from 'vitest';
import {chooseReading, formatKanaReading} from '../readingChoice.js';

describe('reading choice', () => {
    it('formats kana with romaji and drops kanji', () => {
        expect(formatKanaReading('こんにちは。')).toBe('こんにちは。（konnichiha.）');
        expect(formatKanaReading('こんにちは（konnichiwa）')).toBe('こんにちは（konnichiha）');
        expect(formatKanaReading('今日はいい天気')).toBe('');
        expect(formatKanaReading('konnichiwa')).toBe('');
    });

    it('prefers a dictionary reading that already has kana', () => {
        expect(chooseReading('こんにちは（konnichiwa）', '別のよみ')).toEqual({
            reading: 'こんにちは（konnichiwa）',
            source: 'dict'
        });
    });

    it('uses model kana when the dictionary reading is empty or romaji only', () => {
        expect(chooseReading('', 'こんにちは。')).toEqual({
            reading: 'こんにちは。（konnichiha.）',
            source: 'model'
        });
        expect(chooseReading('konnichiwa', 'こんにちは。').source).toBe('model');
    });

    it('reports none when neither source has kana', () => {
        expect(chooseReading('', '今日')).toEqual({reading: '', source: 'none'});
    });
});
