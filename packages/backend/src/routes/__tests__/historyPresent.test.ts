import {describe, expect, it} from 'vitest';
import type {CardHistoryRecord} from '../../database/cardHistory.js';
import {presentHistoryCard} from '../history.js';

const card = (overrides: Partial<CardHistoryRecord>): CardHistoryRecord => ({
    id: 'card-1',
    userId: 'user-1',
    sentence: 'こんにちは。',
    sentenceHtml: 'こんにちは。',
    gloss: '你好。',
    reading: '',
    readingTokens: null,
    audioUrl: null,
    illustrationUrl: null,
    level: 'N5',
    createdAt: '2026-10-25 04:20:00',
    ...overrides
});

describe('presentHistoryCard', () => {
    it('shows the practice reading and Shanghai time for rows saved before readings existed', () => {
        const presented = presentHistoryCard(card({}));
        expect(presented.reading).toBe('こんにちは（konnichiwa）');
        expect(presented.readingTokens).toBeNull();
        expect(presented.createdAtText).toBe('2026/10/25 12:20');
    });

    it('keeps stored reading tokens so playback can highlight them', () => {
        const tokens = [{surface: 'こんにちは。', reading: 'こんにちは。', moraWeight: 5}];
        const presented = presentHistoryCard(card({readingTokens: tokens}));
        expect(presented.readingTokens).toEqual(tokens);
    });

    it('replaces a stored romaji-only practice reading with the deck kana', () => {
        const presented = presentHistoryCard(card({reading: 'konnichiwa'}));
        expect(presented.reading).toBe('こんにちは（konnichiwa）');
    });

    it('keeps a stored romaji reading when the sentence is not in the practice deck', () => {
        const presented = presentHistoryCard(card({
            sentence: 'モデルの文です。',
            reading: 'moderu no bun desu'
        }));
        expect(presented.reading).toBe('moderu no bun desu');
    });

    it('keeps a stored reading and does not show the raw UTC clock', () => {
        const presented = presentHistoryCard(card({
            sentence: 'モデルの文です。',
            reading: 'もでるのぶんです（moderu no bun desu）',
            createdAt: '2026-10-25T16:30:00Z'
        }));
        expect(presented.reading).toBe('もでるのぶんです（moderu no bun desu）');
        expect(presented.createdAtText).toBe('2026/10/26 00:30');
        expect(presented.createdAtText).not.toContain('16:30');
    });
});
