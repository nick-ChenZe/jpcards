import {describe, expect, it} from 'vitest';
import {buildFootprintMonth, shiftFootprintMonth} from '../../../../frontend/src/lib/heatmapGrid';

describe('monthly paper footprints', () => {
    it('aligns a month to Sunday-first rows without inventing dates', () => {
        const month = buildFootprintMonth('2026-10', '2026-10-25', new Map());
        expect(month.from).toBe('2026-10-01');
        expect(month.to).toBe('2026-10-31');
        expect(month.cells).toHaveLength(35);
        expect(month.cells.slice(0, 4)).toEqual([null, null, null, null]);
        expect(month.cells[4]?.day).toBe('2026-10-01');
        expect(month.cells[34]?.day).toBe('2026-10-31');
        expect(month.cells.filter(Boolean)).toHaveLength(31);
    });

    it('includes leap day and pads the final week', () => {
        const month = buildFootprintMonth('2024-02', '2026-10-25', new Map());
        expect(month.to).toBe('2024-02-29');
        expect(month.cells).toHaveLength(35);
        expect(month.cells.filter(Boolean)).toHaveLength(29);
        expect(month.cells[32]?.day).toBe('2024-02-29');
        expect(month.cells[33]).toBeNull();
    });

    it('keeps the actual ink counts and leaves future days empty', () => {
        const month = buildFootprintMonth(
            '2026-10',
            '2026-10-25',
            new Map([
                ['2026-10-02', 5],
                ['2026-10-25', 2],
                ['2026-10-26', 9]
            ])
        );
        expect(month.cells.find((cell) => cell?.day === '2026-10-02')).toMatchObject({count: 5, level: 4});
        expect(month.cells.find((cell) => cell?.day === '2026-10-25')).toMatchObject({count: 2, today: true});
        expect(month.cells.find((cell) => cell?.day === '2026-10-26')).toMatchObject({count: 0, future: true});
    });

    it('moves over year boundaries and rejects malformed months', () => {
        expect(shiftFootprintMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftFootprintMonth('2025-12', 1)).toBe('2026-01');
        expect(() => buildFootprintMonth('2026-13', '2026-10-25', new Map())).toThrow();
    });
});
