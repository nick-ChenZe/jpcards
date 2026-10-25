import {describe, expect, it} from 'vitest';
import {countCardsByShanghaiDay, resolveHeatmapRange} from '../heatmap.js';
import {shiftShanghaiDayKey} from '../shanghaiTime.js';

const NOON = new Date('2026-10-25T04:00:00.000Z');

describe('countCardsByShanghaiDay', () => {
    it('splits cards on Shanghai midnight and keeps several draws on the same day', () => {
        expect(countCardsByShanghaiDay(
            [
                '2026-10-24 15:59:59',
                '2026-10-24 16:00:00',
                '2026-10-24 16:10:00',
                '2026-10-25 15:59:59',
                '2026-10-25 16:00:00',
                '2026-10-25T16:30:00Z',
                'not-a-date',
                ''
            ],
            '2026-10-24',
            '2026-10-26'
        )).toEqual([
            {day: '2026-10-24', count: 1},
            {day: '2026-10-25', count: 3},
            {day: '2026-10-26', count: 2}
        ]);
    });

    it('omits days with no cards, including a gap between two draws', () => {
        expect(countCardsByShanghaiDay(
            [
                '2026-10-24 04:00:00',
                '2026-10-26 04:00:00'
            ],
            '2026-10-24',
            '2026-10-26'
        )).toEqual([
            {day: '2026-10-24', count: 1},
            {day: '2026-10-26', count: 1}
        ]);
    });

    it('drops days outside the requested Shanghai window', () => {
        expect(countCardsByShanghaiDay(
            [
                '2026-10-23 16:00:00',
                '2026-10-25 04:00:00'
            ],
            '2026-10-25',
            '2026-10-25'
        )).toEqual([
            {day: '2026-10-25', count: 1}
        ]);
    });
});

describe('resolveHeatmapRange', () => {
    it('defaults to the 84 Shanghai days ending today', () => {
        expect(resolveHeatmapRange(undefined, undefined, NOON)).toEqual({
            ok: true,
            from: '2026-08-03',
            to: '2026-10-25'
        });
        expect(resolveHeatmapRange('2026-10-01', undefined, NOON)).toEqual({
            ok: true,
            from: '2026-10-01',
            to: '2026-10-25'
        });
        expect(resolveHeatmapRange(undefined, '2026-10-01', NOON)).toEqual({
            ok: true,
            from: shiftShanghaiDayKey('2026-10-01', -83),
            to: '2026-10-01'
        });
    });

    it('rejects an inverted window, a bad day, and a span past 400 days', () => {
        expect(resolveHeatmapRange('2026-10-26', '2026-10-24', NOON).ok).toBe(false);
        expect(resolveHeatmapRange('2026-02-29', '2026-03-01', NOON).ok).toBe(false);
        expect(resolveHeatmapRange(shiftShanghaiDayKey('2026-10-25', -399), '2026-10-25', NOON).ok).toBe(true);
        expect(resolveHeatmapRange(shiftShanghaiDayKey('2026-10-25', -400), '2026-10-25', NOON).ok).toBe(false);
    });
});
