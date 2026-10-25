import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {streakChipText} from '../../../../frontend/src/lib/streakNote';

const frontendRoot = fileURLToPath(new URL('../../../../frontend/', import.meta.url));

describe('streak chip copy', () => {
    it('holds a quiet blank until the first /api/me read settles', () => {
        expect(streakChipText(null, true)).toBeNull();
    });

    it('keeps the numbered aside once a real count is known, including mid-refresh', () => {
        expect(streakChipText(1, false)).toBe('已连签 1 天 · 轻记一下就好');
        expect(streakChipText(12, true)).toBe('已连签 12 天 · 轻记一下就好');
        expect(streakChipText(1.9, false)).toBe('已连签 1 天 · 轻记一下就好');
    });

    it('uses the soft empty line for zero or an unset read, without inventing a streak', () => {
        expect(streakChipText(0, false)).toBe('轻记一下就好');
        expect(streakChipText(null, false)).toBe('轻记一下就好');
        expect(streakChipText(Number.NaN, false)).toBe('轻记一下就好');
        expect(streakChipText(-2, false)).toBe('轻记一下就好');
    });

    it('styles the chip as a muted paper note, not an accent badge', () => {
        const css = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
        const rules = css.match(/\.streak-chip[^{]*\{[^}]*\}/g) ?? [];
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) {
            expect(rule).not.toContain('var(--accent)');
            expect(rule).not.toContain('#C45C4A');
        }
        expect(css).not.toContain('.streak-chip .dot');

        const explore = readFileSync(path.join(frontendRoot, 'src/components/pages/ExplorePage.tsx'), 'utf8');
        expect(explore).not.toContain('className="dot"');
        expect(explore).toContain('streakChipText');
        expect(explore).toContain('streakPending');

        const note = readFileSync(path.join(frontendRoot, 'src/lib/streakNote.ts'), 'utf8');
        expect(note).toContain('已连签 ${count} 天 · 轻记一下就好');
        expect(note).toContain('return \'轻记一下就好\'');
    });
});
