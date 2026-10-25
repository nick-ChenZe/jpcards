import {describe, expect, it} from 'vitest';
import {countStreakDays} from '../streak.js';

const NOON = new Date('2026-10-25T04:00:00.000Z');

describe('countStreakDays', () => {
    it('counts a single Shanghai day once even with several cards', () => {
        expect(countStreakDays([
            '2026-10-25 01:00:00',
            '2026-10-25 03:00:00'
        ], NOON)).toBe(1);
    });

    it('keeps yesterday when today has no card yet', () => {
        expect(countStreakDays(['2026-10-24 02:00:00'], NOON)).toBe(1);
        expect(countStreakDays([
            '2026-10-25 01:00:00',
            '2026-10-24 02:00:00',
            '2026-10-23 08:00:00'
        ], NOON)).toBe(3);
    });

    it('stops at the first missed Shanghai day', () => {
        expect(countStreakDays([
            '2026-10-25 01:00:00',
            '2026-10-23 08:00:00'
        ], NOON)).toBe(1);
        expect(countStreakDays(['2026-10-22 08:00:00'], NOON)).toBe(0);
        expect(countStreakDays([], NOON)).toBe(0);
    });

    it('uses the Shanghai date when UTC is still the previous evening', () => {
        const justAfterMidnight = new Date('2026-10-24T16:30:00.000Z');
        expect(countStreakDays(['2026-10-24 16:10:00'], justAfterMidnight)).toBe(1);
        expect(countStreakDays(['2026-10-24 15:00:00'], justAfterMidnight)).toBe(1);
    });

    it('ignores timestamps that cannot be parsed', () => {
        expect(countStreakDays(['not-a-date', ''], NOON)).toBe(0);
    });
});
