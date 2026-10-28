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
        expect(css).not.toMatch(/\.btn-draw\.is-exhausted[^{]*\{[^}]*line-clamp/);
    });
});
