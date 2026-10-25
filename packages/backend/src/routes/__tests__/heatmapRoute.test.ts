import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {shanghaiDayWindow, shiftShanghaiDayKey} from '../../utils/shanghaiTime.js';

const sessionState = vi.hoisted(() => ({
    userId: 'user-1' as string | null
}));

vi.mock('../auth.js', () => ({
    AuthConfigError: class AuthConfigError extends Error {},
    auth: () => ({
        api: {
            getSession: async () => {
                if (!sessionState.userId) {
                    return null;
                }
                return {user: {id: sessionState.userId, name: '测试', email: 'one@example.com'}};
            }
        }
    })
}));

import app from '../../index.js';

const migrationSql = ['0001_init.sql', '0002_card_gloss.sql', '0003_card_reading.sql', '0005_card_reading_tokens.sql']
    .map((name) => readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'))
    .join('\n');

function createEnv (extraSql = ''): Env {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    sqlite.exec(`
        INSERT INTO "user" (
            id, name, email, emailVerified, image, createdAt, updatedAt, username, displayUsername
        ) VALUES
            ('user-1', '甲', 'one@example.com', 1, NULL, 0, 0, 'one', 'one'),
            ('user-2', '乙', 'two@example.com', 1, NULL, 0, 0, 'two', 'two');
    `);
    if (extraSql) {
        sqlite.exec(extraSql);
    }
    const db = {
        prepare(query: string) {
            const statement = sqlite.prepare(query);
            const bind = (...params: unknown[]) => {
                const values = params.map((value) => value === undefined ? null : value);
                return {
                    async all() {
                        statement.setReturnArrays(false);
                        return {results: statement.all(...values)};
                    },
                    async run() {
                        const info = statement.run(...values);
                        return {success: true, meta: {changes: Number(info.changes)}};
                    },
                    async raw() {
                        statement.setReturnArrays(true);
                        try {
                            return statement.all(...values);
                        } finally {
                            statement.setReturnArrays(false);
                        }
                    }
                };
            };
            return {bind};
        }
    };
    return {
        DB: db,
        ASSETS: {fetch: async () => new Response('ok')},
        BETTER_AUTH_SECRET: 'local-test-secret-not-used'
    } as unknown as Env;
}

const midnightCards = `
    INSERT INTO card_history (
        id, user_id, sentence, sentence_html, gloss, reading, level, created_at
    ) VALUES
        ('card-a', 'user-1', '前一天夜里', '前一天夜里', '', '', 'N5', '2026-10-24 15:59:59'),
        ('card-b', 'user-1', '刚过零点', '刚过零点', '', '', 'N5', '2026-10-24 16:10:00'),
        ('card-c', 'user-1', '同一天第二张', '同一天第二张', '', '', 'N5', '2026-10-25 15:00:00'),
        ('card-d', 'user-1', '下一天', '下一天', '', '', 'N5', '2026-10-25 16:00:00'),
        ('card-e', 'user-2', '别人的', '别人的', '', '', 'N5', '2026-10-25 02:00:00');
`;

describe('heatmap and history day', () => {
    beforeEach(() => {
        sessionState.userId = 'user-1';
    });

    it('requires a session', async () => {
        sessionState.userId = null;
        const env = createEnv();
        const heatmap = await app.request('/api/me/heatmap', {}, env);
        const history = await app.request('/api/history?day=2026-10-25', {}, env);
        expect(heatmap.status).toBe(401);
        expect(history.status).toBe(401);
    });

    it('counts the caller cards on Shanghai days and opens that day on the wall', async () => {
        const env = createEnv(midnightCards);
        const heatmap = await app.request('/api/me/heatmap?from=2026-10-24&to=2026-10-26', {}, env);
        expect(heatmap.status).toBe(200);
        expect(await heatmap.json()).toEqual([
            {day: '2026-10-24', count: 1},
            {day: '2026-10-25', count: 2},
            {day: '2026-10-26', count: 1}
        ]);

        const day = await app.request('/api/history?day=2026-10-25', {}, env);
        expect(day.status).toBe(200);
        const body = await day.json() as {items: {id: string;}[]; pagination: {total: number;};};
        expect(body.items.map((item) => item.id)).toEqual(['card-c', 'card-b']);
        expect(body.pagination.total).toBe(2);

        const all = await app.request('/api/history?pageSize=20', {}, env);
        const allBody = await all.json() as {items: {id: string;}[]; pagination: {total: number;};};
        expect(allBody.pagination.total).toBe(4);
        expect(allBody.items.map((item) => item.id)).not.toContain('card-e');
    });

    it('keeps the default window on Shanghai days and rejects a bad day', async () => {
        const today = shanghaiDayWindow(new Date()).dayKey;
        const inside = shiftShanghaiDayKey(today, -83);
        const outside = shiftShanghaiDayKey(today, -100);
        const edgeUtc = shiftShanghaiDayKey(inside, -1);
        const env = createEnv(`
            INSERT INTO card_history (
                id, user_id, sentence, sentence_html, gloss, reading, level, created_at
            ) VALUES
                ('today-card', 'user-1', '今天', '今天', '', '', 'N5', '${today} 04:00:00'),
                ('edge-card', 'user-1', '窗口第一天', '窗口第一天', '', '', 'N5', '${edgeUtc} 16:00:00'),
                ('early-card', 'user-1', '更早', '更早', '', '', 'N5', '${edgeUtc} 15:59:59'),
                ('old-card', 'user-1', '太早', '太早', '', '', 'N5', '${outside} 04:00:00');
        `);
        const heatmap = await app.request('/api/me/heatmap', {}, env);
        expect(heatmap.status).toBe(200);
        const days = await heatmap.json() as {day: string; count: number;}[];
        expect(days).toEqual([
            {day: inside, count: 1},
            {day: today, count: 1}
        ]);

        const badHeat = await app.request('/api/me/heatmap?from=2026-02-29&to=2026-03-01', {}, env);
        expect(badHeat.status).toBe(400);
        const badDay = await app.request('/api/history?day=2026-02-31', {}, env);
        expect(badDay.status).toBe(400);
        expect(await badDay.json()).toMatchObject({error: 'INVALID_DAY'});
    });
});
