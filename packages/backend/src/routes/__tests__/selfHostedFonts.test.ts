import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {QUOTA_EXCEEDED_MESSAGE} from '../../userCopy.js';

const PRODUCT_EXHAUSTED = '今日额度已用完，明天 0 点（北京时间）再来';
const frontendRoot = fileURLToPath(new URL('../../../../frontend/', import.meta.url));

const FONT_FILES = [
    'noto-sans-sc-chinese-simplified-400-normal.woff2',
    'noto-sans-sc-chinese-simplified-500-normal.woff2',
    'noto-serif-jp-japanese-500-normal.woff2'
];

function frontendTextFiles (): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, {withFileTypes: true})) {
            if (entry.name === 'node_modules' || entry.name === 'dist') {
                continue;
            }
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (/\.(html|css|ts|tsx|js|mjs|md|json)$/.test(entry.name)) {
                out.push(full);
            }
        }
    };
    walk(frontendRoot);
    return out;
}

describe('self-hosted font subsets', () => {
    it('does not reference the Google Fonts CDN', () => {
        const offenders = frontendTextFiles().filter((file) => {
            const text = readFileSync(file, 'utf8');
            return text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com');
        });
        expect(offenders).toEqual([]);
    });

    it('serves Noto Sans SC 400/500 and Noto Serif JP 500 from local woff2 subsets', () => {
        const css = readFileSync(path.join(frontendRoot, 'src/fonts/fonts.css'), 'utf8');
        expect(css).toContain('font-family: "Noto Sans SC"');
        expect(css).toContain('font-family: "Noto Serif JP"');
        expect(css).toContain('font-weight: 400');
        expect(css).toContain('font-weight: 500');
        expect(css).not.toContain('fonts.googleapis.com');
        expect(css).not.toContain('fonts.gstatic.com');

        const tokens = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
        expect(tokens).toContain('--font-ja: "Noto Serif JP"');
        expect(tokens).toContain('--font-zh: "Noto Sans SC"');

        for (const filename of FONT_FILES) {
            expect(css).toContain(`./${filename}`);
            const bytes = readFileSync(path.join(frontendRoot, 'src/fonts', filename));
            expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
            expect(bytes.length).toBeGreaterThan(100_000);
            expect(bytes.length).toBeLessThan(4_000_000);
        }
    });
});

describe('exhausted quota copy', () => {
    it('matches the #8 final on the API and the explore UI', () => {
        expect(QUOTA_EXCEEDED_MESSAGE).toBe(PRODUCT_EXHAUSTED);

        const frontendCopy = readFileSync(path.join(frontendRoot, 'src/lib/userCopy.ts'), 'utf8');
        expect(frontendCopy).toContain(`export const QUOTA_EXCEEDED_MESSAGE = '${PRODUCT_EXHAUSTED}'`);

        const generateBar = readFileSync(path.join(frontendRoot, 'src/components/GenerateBar.tsx'), 'utf8');
        const quotaSeal = readFileSync(path.join(frontendRoot, 'src/components/QuotaSeal.tsx'), 'utf8');
        const explore = readFileSync(path.join(frontendRoot, 'src/components/pages/ExplorePage.tsx'), 'utf8');
        expect(quotaSeal).toContain('QUOTA_EXCEEDED_MESSAGE');
        expect(explore).toContain('QUOTA_EXCEEDED_MESSAGE');
        expect(quotaSeal).toContain('今日还可生成');
        expect(generateBar).not.toContain('quota-hint');
        expect(generateBar).not.toContain('今日额度用完了');
        expect(explore).not.toContain('今日额度用完了');
        expect(frontendCopy).not.toContain('今日额度用完了');
    });
});
