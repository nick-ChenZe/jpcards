import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {paceQwenImage, QWEN_PRO_MIN_INTERVAL_MS, QWEN_PRO_RPM, QwenImageLimiter} from '../qwenQueue.js';

describe('Qwen pro rate limit', () => {
    it('spaces calls for about 20 requests per minute', () => {
        expect(QWEN_PRO_RPM).toBe(20);
        expect(QWEN_PRO_MIN_INTERVAL_MS).toBe(3000);

        const limiter = new QwenImageLimiter();
        const first = limiter.plan(1_000);
        const second = limiter.plan(1_000);
        expect(first.waitMs).toBe(0);
        expect(second.waitMs).toBe(3000);
        expect(second.nextAt - first.nextAt).toBe(3000);
    });

    it('waits for the planned gap before the next send', async () => {
        const limiter = new QwenImageLimiter();
        const slept: number[] = [];
        const first = await paceQwenImage(limiter, 1_000, async (ms) => {
            slept.push(ms);
        });
        const second = await paceQwenImage(limiter, 1_000, async (ms) => {
            slept.push(ms);
        });
        expect(first).toBe(0);
        expect(second).toBe(3000);
        expect(slept).toEqual([3000]);
    });
});

describe('name card eval fixtures', () => {
    const fixtures = JSON.parse(
        readFileSync(new URL('../../../fixtures/image-name-cards.json', import.meta.url), 'utf8')
    ) as Array<{
        id: string;
        group: string;
        displayName: string;
        reading: string;
        finePrint: string;
        prompt: string;
    }>;

    it('covers CJK plus Latin, fine print, and unusual names', () => {
        const groups = new Set(fixtures.map((item) => item.group));
        expect(groups).toEqual(new Set(['cjk-latin', 'fine-text', 'unusual-name']));
        expect(fixtures.length).toBeGreaterThanOrEqual(9);
        for (const item of fixtures) {
            expect(item.displayName.trim().length).toBeGreaterThan(0);
            expect(item.prompt).toContain(item.displayName);
        }
        const script = readFileSync(new URL('../../../scripts/eval-qwen-image.mjs', import.meta.url), 'utf8');
        expect(script).not.toMatch(/\bfetch\s*\(/);
        expect(script).toContain('qwen-image-3.0');
        expect(script).not.toContain('qwen-image-2.1-turbo 是默认');
    });
});
