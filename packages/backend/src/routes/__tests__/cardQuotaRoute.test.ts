import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {QUOTA_COOLDOWN_MESSAGE, QUOTA_EXCEEDED_MESSAGE} from '../../userCopy.js';

const sessionState = vi.hoisted(() => ({userId: 'user-1' as string | null}));
const cardApi = vi.hoisted(() => ({
    buildCardWithMemory: vi.fn(async () => ({
        ok: true as const,
        card: {id: 'card-1', sentence: 'こんにちは。'}
    }))
}));

vi.mock('../auth.js', () => ({
    AuthConfigError: class AuthConfigError extends Error {},
    auth: () => ({
        api: {
            getSession: async () => {
                if (!sessionState.userId) {
                    return null;
                }
                return {user: {id: sessionState.userId, name: '测试', email: 'test@example.com'}};
            }
        }
    })
}));

vi.mock('../card.js', () => cardApi);

vi.mock('../history.js', () => ({
    getHistoryResponse: vi.fn(async () => ({
        items: [{id: 'old-card', sentence: '前一天的卡片'}],
        pagination: {page: 1, pageSize: 20, total: 1, totalPages: 1}
    })),
    getHistoryCardResponse: vi.fn(async () => ({id: 'old-card', sentence: '前一天的卡片'}))
}));

import app from '../../index.js';
import {CARD_GENERATION_INTERVAL_MS, DAILY_CARD_LIMIT} from '../../quota/cardQuota.js';

const migrationSql = readFileSync(new URL('../../../migrations/0004_daily_card_quota.sql', import.meta.url), 'utf8');
const dayStart = new Date('2026-10-25T02:00:00.000Z');

function createEnv () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    const db = {
        prepare(query: string) {
            const statement = sqlite.prepare(query);
            const run = (params: Array<string | number>) => {
                if (/^\s*select/i.test(query)) {
                    const results = statement.all(...params).map((row) => ({...row}));
                    return {success: true, results, meta: {changes: 0}};
                }
                const info = statement.run(...params);
                return {success: true, results: [], meta: {changes: Number(info.changes)}};
            };
            return {
                bind(...params: Array<string | number>) {
                    return {
                        async run() {
                            return run(params);
                        }
                    };
                }
            };
        }
    };
    return {
        sqlite,
        env: {
            DB: db,
            ASSETS: {fetch: async () => new Response('ok')},
            BETTER_AUTH_SECRET: 'local-test-secret-not-used-for-quota'
        } as unknown as Env
    };
}

describe('card quota routes', () => {
    beforeEach(() => {
        sessionState.userId = 'user-1';
        cardApi.buildCardWithMemory.mockClear();
        cardApi.buildCardWithMemory.mockResolvedValue({
            ok: true,
            card: {id: 'card-1', sentence: 'こんにちは。'}
        });
        vi.useFakeTimers({toFake: ['Date']});
        vi.setSystemTime(dayStart);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns the daily quota and answers 429 in Chinese once 20 cards are used', async () => {
        const {env} = createEnv();
        const initial = await app.request('/api/me/quota', {}, env);
        expect(initial.status).toBe(200);
        expect(await initial.json()).toEqual({
            limit: 20,
            used: 0,
            remaining: 20,
            resetsAt: '2026-10-25T16:00:00.000Z'
        });

        for (let index = 0; index < DAILY_CARD_LIMIT; index += 1) {
            vi.setSystemTime(new Date(dayStart.getTime() + index * CARD_GENERATION_INTERVAL_MS));
            const response = await app.request('/api/card', {}, env);
            expect(response.status).toBe(200);
        }
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(DAILY_CARD_LIMIT);

        vi.setSystemTime(new Date(dayStart.getTime() + DAILY_CARD_LIMIT * CARD_GENERATION_INTERVAL_MS));
        const denied = await app.request('/api/card', {}, env);
        expect(denied.status).toBe(429);
        expect(await denied.json()).toEqual({
            error: 'QUOTA_EXCEEDED',
            message: QUOTA_EXCEEDED_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(DAILY_CARD_LIMIT);

        const quota = await app.request('/api/me/quota', {}, env);
        expect(await quota.json()).toEqual({
            limit: 20,
            used: 20,
            remaining: 0,
            resetsAt: '2026-10-25T16:00:00.000Z'
        });
    });

    it('resets after Shanghai midnight and blocks a second click inside 5 seconds', async () => {
        const {env} = createEnv();
        const first = await app.request('/api/card', {}, env);
        expect(first.status).toBe(200);

        const cooldown = await app.request('/api/card', {}, env);
        expect(cooldown.status).toBe(429);
        expect(await cooldown.json()).toEqual({
            error: 'QUOTA_COOLDOWN',
            message: QUOTA_COOLDOWN_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);

        vi.setSystemTime(new Date('2026-10-25T16:00:00.000Z'));
        const reset = await app.request('/api/me/quota', {}, env);
        expect(await reset.json()).toMatchObject({used: 0, remaining: 20, resetsAt: '2026-10-26T16:00:00.000Z'});

        const nextDay = await app.request('/api/card', {}, env);
        expect(nextDay.status).toBe(200);
        const quota = await app.request('/api/me/quota', {}, env);
        expect(await quota.json()).toMatchObject({used: 1, remaining: 19, resetsAt: '2026-10-26T16:00:00.000Z'});
    });

    it('does not charge quota when history is read, and still charges when generation fails', async () => {
        const {env} = createEnv();
        const list = await app.request('/api/history', {}, env);
        const detail = await app.request('/api/history/old-card', {}, env);
        expect(list.status).toBe(200);
        expect(detail.status).toBe(200);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

        cardApi.buildCardWithMemory.mockRejectedValueOnce(new Error('text model down'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failed = await app.request('/api/card', {}, env);
        expect(failed.status).toBe(500);
        expect(await failed.json()).toEqual({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'});
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
        errorSpy.mockRestore();
    });

    it('rejects anonymous quota and card requests', async () => {
        sessionState.userId = null;
        const {env} = createEnv();
        expect((await app.request('/api/me/quota', {}, env)).status).toBe(401);
        expect((await app.request('/api/card', {}, env)).status).toBe(401);
        expect(cardApi.buildCardWithMemory).not.toHaveBeenCalled();
    });
});
