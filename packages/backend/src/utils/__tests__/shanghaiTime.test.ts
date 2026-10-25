import {describe, expect, it} from 'vitest';
import {
    formatShanghaiTimestamp,
    inclusiveShanghaiDayCount,
    parseShanghaiDayKey,
    shanghaiDayWindow,
    wallDateFromStored
} from '../shanghaiTime.js';

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

describe('wallDateFromStored', () => {
    it('uses each card Shanghai calendar date instead of labeling the wall 今天', () => {
        expect(wallDateFromStored('2026-10-23 03:00:00')).toEqual({
            key: '2026-10-23',
            month: 10,
            day: 23,
            breath: '10月23日'
        });
        expect(wallDateFromStored('2026-10-24 03:00:00').breath).toBe('10月24日');
        expect(wallDateFromStored('2026-10-25 02:00:00')).toMatchObject({
            key: '2026-10-25',
            month: 10,
            day: 25,
            breath: '10月25日'
        });
        expect(wallDateFromStored('2026-10-25T16:30:00Z')).toEqual({
            key: '2026-10-26',
            month: 10,
            day: 26,
            breath: '10月26日'
        });
        const labels = ['2026-10-23 03:00:00', '2026-10-24 03:00:00', '2026-10-25 02:00:00']
            .map((value) => wallDateFromStored(value).breath);
        expect(labels).toEqual(['10月23日', '10月24日', '10月25日']);
        expect(labels).not.toContain('今天');
    });

    it('keeps a timestamp that already has an offset on that Shanghai day', () => {
        expect(wallDateFromStored('2026-10-25T12:20:00+08:00')).toMatchObject({
            key: '2026-10-25',
            breath: '10月25日'
        });
    });

    it('leaves an unreadable timestamp as-is instead of calling it 今天', () => {
        expect(wallDateFromStored('not-a-date')).toEqual({
            key: 'not-a-date',
            month: 0,
            day: 0,
            breath: 'not-a-date'
        });
        expect(wallDateFromStored('')).toEqual({
            key: 'unknown',
            month: 0,
            day: 0,
            breath: ''
        });
    });
});

describe('parseShanghaiDayKey', () => {
    it('accepts a real calendar day and rejects impossible ones', () => {
        expect(parseShanghaiDayKey(' 2026-10-25 ')).toBe('2026-10-25');
        expect(parseShanghaiDayKey('2026-02-29')).toBeNull();
        expect(parseShanghaiDayKey('2026-10-5')).toBeNull();
        expect(inclusiveShanghaiDayCount('2026-10-24', '2026-10-26')).toBe(3);
    });
});
