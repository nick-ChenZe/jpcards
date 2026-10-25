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
    audioUrl: null,
    illustrationUrl: null,
    level: 'N5',
    createdAt: '2026-10-25 04:20:00',
    ...overrides
});

describe('presentHistoryCard', () => {
    it('shows the practice reading and Shanghai time for rows saved before readings existed', () => {
        const presented = presentHistoryCard(card({}));
        expect(presented.reading).toBe('konnichiwa');
        expect(presented.createdAtText).toBe('2026/10/25 12:20');
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
