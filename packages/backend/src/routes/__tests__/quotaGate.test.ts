import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {readCardResponse} from '../../../../frontend/src/lib/cardProgress';
import {gateDrawAttempt, isQuotaExceededDenial, quotaSealExhaustedAttr} from '../../../../frontend/src/lib/quotaGate';
import {QUOTA_COOLDOWN_MESSAGE, QUOTA_EXCEEDED_MESSAGE} from '../../userCopy.js';

const frontendRoot = fileURLToPath(new URL('../../../../frontend/', import.meta.url));

describe('exhausted draw gate', () => {
    it('stops a known-zero allowance and an in-flight draw, and still allows an unknown read', () => {
        expect(gateDrawAttempt({inFlight: false, remaining: 0})).toBe('stop');
        expect(gateDrawAttempt({inFlight: false, remaining: -1})).toBe('stop');
        expect(gateDrawAttempt({inFlight: true, remaining: 3})).toBe('stop');
        expect(gateDrawAttempt({inFlight: false, remaining: null})).toBe('start');
        expect(gateDrawAttempt({inFlight: false, remaining: 1})).toBe('start');
    });

    it('treats only the quota 429 as exhausted, not the cooldown 429', () => {
        expect(isQuotaExceededDenial(429, {error: 'QUOTA_EXCEEDED', message: QUOTA_EXCEEDED_MESSAGE})).toBe(true);
        expect(isQuotaExceededDenial(429, {message: QUOTA_EXCEEDED_MESSAGE})).toBe(true);
        expect(isQuotaExceededDenial(429, {error: 'QUOTA_COOLDOWN', message: QUOTA_COOLDOWN_MESSAGE})).toBe(false);
        expect(isQuotaExceededDenial(200, {error: 'QUOTA_EXCEEDED'})).toBe(false);
        expect(isQuotaExceededDenial(429, null)).toBe(false);
    });

    it('marks the seal only after a known exhaustion', () => {
        expect(quotaSealExhaustedAttr(0)).toBe('true');
        expect(quotaSealExhaustedAttr(-2)).toBe('true');
        expect(quotaSealExhaustedAttr(null)).toBeUndefined();
        expect(quotaSealExhaustedAttr(4)).toBeUndefined();
    });

    it('keeps a quota 429 out of the drawing state because the stream has no progress', async () => {
        const response = new Response(
            `${
                JSON.stringify({
                    type: 'result',
                    status: 429,
                    body: {error: 'QUOTA_EXCEEDED', message: QUOTA_EXCEEDED_MESSAGE}
                })
            }\n`,
            {headers: {'Content-Type': 'application/x-ndjson'}}
        );
        const stages: string[] = [];
        const result = await readCardResponse(response, stage => stages.push(stage));
        expect(stages).toEqual([]);
        expect(isQuotaExceededDenial(result.status, result.body)).toBe(true);
    });

    it('does not enter drawing before the card request, and does not clip the locked sentence', () => {
        const explore = readFileSync(path.join(frontendRoot, 'src/components/pages/ExplorePage.tsx'), 'utf8');
        const generate = explore.slice(explore.indexOf('const generateCard'), explore.indexOf('const textNote'));
        expect(generate.indexOf('gateDrawAttempt')).toBeLessThan(generate.indexOf('fetch('));
        const enterStart = generate.indexOf('const enterDrawing');
        const enterEnd = generate.indexOf('try {');
        expect(generate.indexOf('setLoading(true)')).toBeGreaterThan(enterStart);
        expect(generate.indexOf('setLoading(true)')).toBeLessThan(enterEnd);
        expect(generate.lastIndexOf('enterDrawing')).toBeGreaterThan(generate.indexOf('fetch('));
        expect(generate.match(/setLoading\(true\)/g)).toEqual(['setLoading(true)']);

        const css = readFileSync(path.join(frontendRoot, 'src/styles/hiyori.css'), 'utf8');
        expect(css).toContain('.quota-seal[data-exhausted="true"]');
        expect(css).toContain('.btn-draw.is-exhausted');
        expect(css).toContain('white-space:normal');
        expect(css).toMatch(/\.btn-draw\.is-exhausted[^{]*\{[^}]*width:100%/);
        expect(css).not.toMatch(/\.btn-draw\.is-exhausted[^{]*\{[^}]*line-clamp/);
        expect(css).toContain('.hero-brow-seal');
        expect(css).toMatch(/\.calendar-screen \.footprint-empty\s*\{[^}]*margin:[^;]*24px/);
        expect(css).toMatch(/\.wall-brow-seal[^{]*\{[^}]*right:5px/);
        expect(css).toMatch(/\.hiyori-app \.wall-date-stamp\s*\{[^}]*right:38px/);
    });

    it('shows a bare zero on the quota seal and drops the dead draw-button seal rule', () => {
        const quotaSeal = readFileSync(path.join(frontendRoot, 'src/components/QuotaSeal.tsx'), 'utf8');
        const zeroAt = quotaSeal.indexOf('return \'0\'');
        const padAt = quotaSeal.indexOf('padStart');
        expect(zeroAt).toBeGreaterThan(0);
        expect(padAt).toBeGreaterThan(zeroAt);
        expect(quotaSeal).toContain('quotaFaceCount(remaining)');

        const indexCss = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
        expect(indexCss).not.toMatch(/\.btn-draw \.seal-mark\b/);
        expect(indexCss).toContain('.btn-draw .seal-fox-mark');
        expect(indexCss).toContain('.hero-chrome .btn-draw.is-exhausted');
        expect(indexCss).toContain('width: 100%');

        const generateBar = readFileSync(path.join(frontendRoot, 'src/components/GenerateBar.tsx'), 'utf8');
        expect(generateBar).toContain('exhausted ? null : <SealFoxMark />');

        const explore = readFileSync(path.join(frontendRoot, 'src/components/pages/ExplorePage.tsx'), 'utf8');
        expect(explore).toContain('hero-brow-seal');

        const auth = readFileSync(path.join(frontendRoot, 'src/components/AuthLayout.tsx'), 'utf8');
        const motif = readFileSync(path.join(frontendRoot, 'src/components/PaperMotif.tsx'), 'utf8');
        expect(auth).not.toContain('rizha-mark');
        expect(motif).not.toContain('rizha-mark');
        expect(auth).toContain('SealFoxMark');
        expect(motif).toContain('SealFoxMark');
    });
});
