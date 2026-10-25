import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {
    CARD_IN_PROGRESS_MESSAGE,
    CARD_METHOD_NOT_ALLOWED_MESSAGE,
    IDEMPOTENCY_KEY_REQUIRED_MESSAGE,
    QUOTA_COOLDOWN_MESSAGE,
    QUOTA_EXCEEDED_MESSAGE
} from '../../userCopy.js';

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
import {CARD_GLOSS_MISSING_MESSAGE} from '../../userCopy.js';
import {CardGlossError} from '../cardGlossError.js';

const quotaMigrationSql = readFileSync(
    new URL('../../../migrations/0004_daily_card_quota.sql', import.meta.url),
    'utf8'
);
const idempotencyMigrationSql = readFileSync(
    new URL('../../../migrations/0006_card_generation_idempotency.sql', import.meta.url),
    'utf8'
);
const dayStart = new Date('2026-10-25T02:00:00.000Z');
let keySeq = 0;

function postCard (env: Env, key?: string) {
    keySeq += 1;
    return app.request('/api/card', {
        method: 'POST',
        headers: {'Idempotency-Key': key ?? `card-key-${keySeq}`}
    }, env);
}

function createEnv () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(quotaMigrationSql);
    sqlite.exec(idempotencyMigrationSql);
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
        keySeq = 0;
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
            const response = await postCard(env);
            expect(response.status).toBe(200);
        }
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(DAILY_CARD_LIMIT);

        vi.setSystemTime(new Date(dayStart.getTime() + DAILY_CARD_LIMIT * CARD_GENERATION_INTERVAL_MS));
        const denied = await postCard(env);
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
        const first = await postCard(env);
        expect(first.status).toBe(200);

        const cooldown = await postCard(env);
        expect(cooldown.status).toBe(429);
        expect(await cooldown.json()).toEqual({
            error: 'QUOTA_COOLDOWN',
            message: QUOTA_COOLDOWN_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);

        vi.setSystemTime(new Date('2026-10-25T16:00:00.000Z'));
        const reset = await app.request('/api/me/quota', {}, env);
        expect(await reset.json()).toMatchObject({used: 0, remaining: 20, resetsAt: '2026-10-26T16:00:00.000Z'});

        const nextDay = await postCard(env);
        expect(nextDay.status).toBe(200);
        const quota = await app.request('/api/me/quota', {}, env);
        expect(await quota.json()).toMatchObject({used: 1, remaining: 19, resetsAt: '2026-10-26T16:00:00.000Z'});
    });

    it('does not charge quota when history is read or when generation fails', async () => {
        const {sqlite, env} = createEnv();
        const list = await app.request('/api/history', {}, env);
        const detail = await app.request('/api/history/old-card', {}, env);
        expect(list.status).toBe(200);
        expect(detail.status).toBe(200);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

        cardApi.buildCardWithMemory.mockRejectedValueOnce(new Error('text model down'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failed = await postCard(env);
        expect(failed.status).toBe(500);
        expect(await failed.json()).toEqual({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'});
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);

        const duringCooldown = await postCard(env);
        expect(duringCooldown.status).toBe(429);
        expect(await duringCooldown.json()).toEqual({
            error: 'QUOTA_COOLDOWN',
            message: QUOTA_COOLDOWN_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

        vi.setSystemTime(new Date(dayStart.getTime() + CARD_GENERATION_INTERVAL_MS));
        cardApi.buildCardWithMemory.mockRejectedValueOnce(new CardGlossError());
        const missingGloss = await postCard(env);
        expect(missingGloss.status).toBe(422);
        expect(await missingGloss.json()).toEqual({
            error: 'CARD_GLOSS_MISSING',
            message: CARD_GLOSS_MISSING_MESSAGE
        });
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});
        expect(sqlite.prepare('SELECT used FROM daily_card_quota WHERE user_id = ?').get('user-1')).toEqual({used: 0});

        vi.setSystemTime(new Date(dayStart.getTime() + 2 * CARD_GENERATION_INTERVAL_MS));
        const saved = await postCard(env);
        expect(saved.status).toBe(200);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
        errorSpy.mockRestore();
    });

    it('keeps the full daily allowance when every attempt fails, then charges one success', async () => {
        const {env} = createEnv();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            for (let index = 0; index < DAILY_CARD_LIMIT; index += 1) {
                vi.setSystemTime(new Date(dayStart.getTime() + index * CARD_GENERATION_INTERVAL_MS));
                cardApi.buildCardWithMemory.mockRejectedValueOnce(new CardGlossError());
                const failed = await postCard(env);
                expect(failed.status).toBe(422);
            }
            expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

            vi.setSystemTime(new Date(dayStart.getTime() + DAILY_CARD_LIMIT * CARD_GENERATION_INTERVAL_MS));
            const saved = await postCard(env);
            expect(saved.status).toBe(200);
            expect(await (await app.request('/api/me/quota', {}, env)).json()).toEqual({
                limit: 20,
                used: 1,
                remaining: 19,
                resetsAt: '2026-10-25T16:00:00.000Z'
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('rejects anonymous quota and card requests', async () => {
        sessionState.userId = null;
        const {env} = createEnv();
        expect((await app.request('/api/me/quota', {}, env)).status).toBe(401);
        expect((await app.request('/api/card', {}, env)).status).toBe(401);
        expect((await postCard(env)).status).toBe(401);
        expect(cardApi.buildCardWithMemory).not.toHaveBeenCalled();
    });

    it('does not reserve quota when GET /api/card is retried', async () => {
        const {env} = createEnv();
        const first = await postCard(env, 'one-tap-key');
        expect(first.status).toBe(200);
        expect(await first.json()).toMatchObject({
            id: 'card-1',
            sentence: 'こんにちは。',
            quota: {
                limit: 20,
                used: 1,
                remaining: 19,
                resetsAt: '2026-10-25T16:00:00.000Z'
            }
        });

        const replayGet = await app.request('/api/card', {}, env);
        expect(replayGet.status).toBe(405);
        expect(replayGet.headers.get('allow')).toBe('POST');
        expect(await replayGet.json()).toEqual({
            error: 'METHOD_NOT_ALLOWED',
            message: CARD_METHOD_NOT_ALLOWED_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
    });

    it('rejects a generate request that has no idempotency key', async () => {
        const {env} = createEnv();
        const missing = await app.request('/api/card', {method: 'POST'}, env);
        expect(missing.status).toBe(400);
        expect(await missing.json()).toEqual({
            error: 'IDEMPOTENCY_KEY_REQUIRED',
            message: IDEMPOTENCY_KEY_REQUIRED_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).not.toHaveBeenCalled();
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});
    });

    it('charges once when the same key is replayed after the cooldown while generation is still running', async () => {
        const {env, sqlite} = createEnv();
        let releaseGeneration: (value: {ok: true; card: {id: string; sentence: string;};}) => void = () => undefined;
        const generation = new Promise<{ok: true; card: {id: string; sentence: string;};}>((resolve) => {
            releaseGeneration = resolve;
        });
        let markStarted: () => void = () => undefined;
        const started = new Promise<void>((resolve) => {
            markStarted = resolve;
        });
        cardApi.buildCardWithMemory.mockImplementation(async () => {
            markStarted();
            return generation;
        });

        const firstPromise = postCard(env, 'same-tap');
        await started;
        vi.setSystemTime(new Date(dayStart.getTime() + CARD_GENERATION_INTERVAL_MS + 1000));
        const retry = await postCard(env, 'same-tap');
        expect(retry.status).toBe(409);
        expect(await retry.json()).toEqual({
            error: 'CARD_IN_PROGRESS',
            message: CARD_IN_PROGRESS_MESSAGE
        });
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});

        releaseGeneration({ok: true, card: {id: 'card-1', sentence: 'こんにちは。'}});
        const first = await firstPromise;
        expect(first.status).toBe(200);
        expect(await first.json()).toMatchObject({id: 'card-1', quota: {used: 1, remaining: 19}});

        const replay = await postCard(env, 'same-tap');
        expect(replay.status).toBe(200);
        expect(await replay.json()).toMatchObject({id: 'card-1', quota: {used: 1, remaining: 19}});
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
        expect(sqlite.prepare('SELECT COUNT(*) AS n FROM card_generation_idempotency').get()).toEqual({n: 1});
    });

    it('keeps the refund when a failed generate is retried with the same key after the cooldown', async () => {
        const {env} = createEnv();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            cardApi.buildCardWithMemory.mockRejectedValueOnce(new Error('text model down'));
            const failed = await postCard(env, 'failed-tap');
            expect(failed.status).toBe(500);
            expect(await failed.json()).toEqual({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'});
            expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

            vi.setSystemTime(new Date(dayStart.getTime() + CARD_GENERATION_INTERVAL_MS + 1000));
            const retry = await postCard(env, 'failed-tap');
            expect(retry.status).toBe(500);
            expect(await retry.json()).toEqual({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'});
            expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(1);
            expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 0, remaining: 20});

            const again = await postCard(env, 'new-tap-key');
            expect(again.status).toBe(200);
            expect(await again.json()).toMatchObject({quota: {used: 1, remaining: 19}});
            expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(2);
            expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('does not replay another user card when the idempotency key matches', async () => {
        const {env} = createEnv();
        const first = await postCard(env, 'shared-key-1');
        expect(first.status).toBe(200);
        expect(await first.json()).toMatchObject({id: 'card-1', quota: {used: 1}});

        sessionState.userId = 'user-2';
        cardApi.buildCardWithMemory.mockResolvedValueOnce({
            ok: true,
            card: {id: 'card-2', sentence: 'さようなら。'}
        });
        const second = await postCard(env, 'shared-key-1');
        expect(second.status).toBe(200);
        expect(await second.json()).toMatchObject({id: 'card-2', quota: {used: 1, remaining: 19}});
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(2);

        sessionState.userId = 'user-1';
        const replay = await postCard(env, 'shared-key-1');
        expect(replay.status).toBe(200);
        expect(await replay.json()).toMatchObject({id: 'card-1', quota: {used: 1}});
        expect(cardApi.buildCardWithMemory).toHaveBeenCalledTimes(2);
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});

        sessionState.userId = 'user-2';
        expect(await (await app.request('/api/me/quota', {}, env)).json()).toMatchObject({used: 1, remaining: 19});
    });
});
