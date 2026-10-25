import {describe, expect, it} from 'vitest';
import {formatShanghaiTimestamp} from '../shanghaiTime.js';

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
