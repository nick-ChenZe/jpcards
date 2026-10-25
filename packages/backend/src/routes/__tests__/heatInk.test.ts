import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {HEAT_INK, heatInkColor, heatInkLevel} from '../../../../frontend/src/lib/heatInk';
import {buildFootprintWeeks} from '../../../../frontend/src/lib/heatmapGrid';

const frontendRoot = fileURLToPath(new URL('../../../../frontend/', import.meta.url));

describe('heat ink levels', () => {
    it('uses the five locked steps and leaves zero as bare paper', () => {
        expect(heatInkLevel(0)).toBe(0);
        expect(heatInkColor(0)).toBeNull();
        expect(heatInkColor(1)).toBe('#E8E0D4');
        expect(heatInkColor(2)).toBe('#C4B8A8');
        expect(heatInkColor(3)).toBe('#8A7E72');
        expect(heatInkColor(4)).toBe('#8A7E72');
        expect(heatInkColor(5)).toBe('#2C2420');
        expect(heatInkColor(9)).toBe('#2C2420');
        expect(heatInkLevel(1)).toBe(1);
        expect(heatInkLevel(2)).toBe(2);
        expect(heatInkLevel(3)).toBe(heatInkLevel(4));
        expect(heatInkLevel(5)).not.toBe(heatInkLevel(4));
        expect(HEAT_INK).toEqual({
            1: '#E8E0D4',
            2: '#C4B8A8',
            3: '#8A7E72',
            4: '#2C2420'
        });
    });

    it('does not paint a gap, and keeps tomorrow empty', () => {
        const weeks = buildFootprintWeeks(
            '2026-10-18',
            '2026-10-25',
            '2026-10-24',
            new Map([
                ['2026-10-18', 1],
                ['2026-10-20', 5],
                ['2026-10-24', 4]
            ])
        );
        const cells = weeks.flatMap((week) => week.cells);
        expect(cells.find((cell) => cell.day === '2026-10-19')).toMatchObject({count: 0, level: 0, future: false});
        expect(cells.find((cell) => cell.day === '2026-10-20')).toMatchObject({count: 5, level: 4});
        expect(cells.find((cell) => cell.day === '2026-10-24')).toMatchObject({count: 4, level: 3, today: true});
        expect(cells.find((cell) => cell.day === '2026-10-25')).toMatchObject({count: 0, level: 0, future: true});
    });

    it('keeps the same colors in CSS and outlines today with a 1px vermilion stroke', () => {
        const css = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
        const ink = readFileSync(path.join(frontendRoot, 'src/lib/heatInk.ts'), 'utf8');
        expect(css).toContain('--heat-ink-1: #E8E0D4;');
        expect(css).toContain('--heat-ink-2: #C4B8A8;');
        expect(css).toContain('--heat-ink-3: #8A7E72;');
        expect(css).toContain('--heat-ink-4: #2C2420;');
        expect(css).toContain('--heat-today: var(--accent);');
        expect(css).toMatch(/\.heat-cell\[data-today="true"\]\s*\{[^}]*1px var\(--heat-today\)/);
        expect(ink).toContain('1: \'#E8E0D4\'');
        expect(ink).toContain('2: \'#C4B8A8\'');
        expect(ink).toContain('3: \'#8A7E72\'');
        expect(ink).toContain('4: \'#2C2420\'');
        expect(ink).not.toMatch(/<=\s*9/);
        expect(ink).not.toMatch(/>=\s*10/);

        const explore = readFileSync(path.join(frontendRoot, 'src/components/pages/ExplorePage.tsx'), 'utf8');
        const history = readFileSync(path.join(frontendRoot, 'src/components/pages/HistoryPage.tsx'), 'utf8');
        const heat = readFileSync(path.join(frontendRoot, 'src/components/FootprintHeat.tsx'), 'utf8');
        expect(explore).not.toContain('FootprintHeat');
        expect(explore).toContain('streakChipText');
        expect(history).toContain('FootprintHeat');
        expect(history).toContain('/api/history?');
        expect(heat).toContain('/api/me/heatmap?from=');
        expect(heat).toContain('/history?day=');
        expect(heat).toContain('这天还没抽');
        expect(heat).toContain('点一日，重读那天');
        expect(`${heat}\n${history}\n${explore}`).not.toMatch(/排名|打卡率|活跃度|KPI/);
    });
});
