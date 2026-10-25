import {describe, expect, it} from 'vitest';
import {formatShanghaiTimestamp, shanghaiDayWindow} from '../shanghaiTime.js';

describe('formatShanghaiTimestamp', () => {
    it('shows a bare UTC timestamp in Asia/Shanghai instead of 凌晨 UTC', () => {
        expect(formatShanghaiTimestamp('2026-10-25 04:20:00')).toBe('2026/10/25 12:20');
        expect(formatShanghaiTimestamp('2026-10-25T04:20:00Z')).toBe('2026/10/25 12:20');
    });

    it('rolls the calendar date forward across Shanghai midnight', () => {
        expect(formatShanghaiTimestamp('2026-10-25 16:30:00')).toBe('2026/10/26 00:30');
    });

    it('does not shift a timestamp that already includes an offset', () => {
        expect(formatShanghaiTimestamp('2026-10-25T12:20:00+08:00')).toBe('2026/10/25 12:20');
    });

    it('keeps empty and invalid values unchanged', () => {
        expect(formatShanghaiTimestamp('')).toBe('');
        expect(formatShanghaiTimestamp('not-a-date')).toBe('not-a-date');
    });
});

describe('shanghaiDayWindow', () => {
    it('resets at the next Asia/Shanghai midnight', () => {
        expect(shanghaiDayWindow(new Date('2026-10-25T02:00:00.000Z'))).toEqual({
            dayKey: '2026-10-25',
            resetsAt: '2026-10-25T16:00:00.000Z'
        });
        expect(shanghaiDayWindow(new Date('2026-10-25T15:59:59.999Z'))).toEqual({
            dayKey: '2026-10-25',
            resetsAt: '2026-10-25T16:00:00.000Z'
        });
    });

    it('starts the new day at 00:00 in Beijing', () => {
        expect(shanghaiDayWindow(new Date('2026-10-25T16:00:00.000Z'))).toEqual({
            dayKey: '2026-10-26',
            resetsAt: '2026-10-26T16:00:00.000Z'
        });
    });
});
