import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {ADMIN_FORBIDDEN_MESSAGE} from '../../userCopy.js';

const sessionState = vi.hoisted(() => ({
    user: null as null | {
        id: string;
        name: string;
        email: string;
        username?: string | null;
    }
}));

vi.mock('../auth.js', () => ({
    AuthConfigError: class AuthConfigError extends Error {},
    auth: () => ({
        api: {
            getSession: async () => {
                if (!sessionState.user) {
                    return null;
                }
                return {user: sessionState.user};
            }
        }
    })
}));

import app from '../../index.js';
import {countStreakDays} from '../../utils/streak.js';

const migrationSql = ['0001_init.sql', '0002_card_gloss.sql', '0003_card_reading.sql', '0005_card_reading_tokens.sql']
    .map((name) => readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'))
    .join('\n');

function createDb () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    sqlite.exec(`
        INSERT INTO "user" (
            id, name, email, emailVerified, image, createdAt, updatedAt, username, displayUsername
        ) VALUES
            ('user-admin', '管理员', 'admin@example.com', 1, NULL, 0, 0, 'admin', 'admin'),
            ('user-other', '其他人', 'other@example.com', 1, NULL, 0, 0, 'other', 'other');

        INSERT INTO card_history (
            id, user_id, sentence, sentence_html, gloss, reading,
            audio_url, illustration_url, level, created_at
        ) VALUES
            (
                'card-old', 'user-other', '其他人的句子', '其他人的句子', '别人的意思', 'たにん',
                'https://example.com/other.mp3', 'https://example.com/other.png', 'N5', '2026-10-25 01:00:00'
            ),
            (
                'card-new', 'user-admin', '管理员的句子', '管理员的句子', '自己的意思', 'かんり',
                'https://example.com/admin.mp3', 'https://example.com/admin.png', 'N4', '2026-10-25 03:00:00'
            ),
            (
                'card-mid', 'user-admin', '中间的句子', '中间的句子', '中间', 'なか',
                NULL, NULL, 'N5', '2026-10-25 02:00:00'
            ),
            (
                'card-orphan', 'missing-user', '孤儿卡片', '孤儿卡片', '没有用户', 'こじ',
                NULL, NULL, 'N5', '2026-10-24 00:00:00'
            );
    `);

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
        BETTER_AUTH_SECRET: 'local-test-secret-not-used-for-admin',
        ADMIN_USER_IDS: ' user-admin , , '
    } as unknown as Env;
}

function auditEntries (spy: {mock: {calls: unknown[][];};}) {
    return spy.mock.calls.flatMap((call) => {
        try {
            const parsed = JSON.parse(String(call[0])) as {audit?: string;};
            return parsed.audit ? [parsed] : [];
        } catch {
            return [];
        }
    });
}

describe('admin cards', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        sessionState.user = {
            id: 'user-admin',
            name: '管理员',
            email: 'Admin@Example.com',
            username: 'admin'
        };
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('rejects anonymous and non-admin callers before reading cards', async () => {
        const env = createDb();
        sessionState.user = null;
        const anonymous = await app.request('/api/admin/cards', {}, env);
        expect(anonymous.status).toBe(401);

        sessionState.user = {id: 'user-other', name: '其他人', email: 'other@example.com'};
        const denied = await app.request('/api/admin/cards', {}, env);
        expect(denied.status).toBe(403);
        const body = await denied.json() as {error: string; message: string; items?: unknown;};
        expect(body).toEqual({error: 'FORBIDDEN', message: ADMIN_FORBIDDEN_MESSAGE});
        expect(JSON.stringify(body)).not.toContain('管理员的句子');

        const me = await app.request('/api/me', {}, env);
        expect(await me.json()).toEqual({
            id: 'user-other',
            email: 'other@example.com',
            name: '其他人',
            username: null,
            isAdmin: false,
            streakDays: countStreakDays(['2026-10-25 01:00:00'], new Date())
        });
        expect(auditEntries(logSpy)).toEqual([]);
    });

    it('does not query the database when the allowlist misses the caller', async () => {
        sessionState.user = {id: 'user-admin', name: '管理员', email: 'admin@example.com'};
        const env = {
            DB: {
                prepare() {
                    throw new Error('should not query');
                }
            },
            ASSETS: {fetch: async () => new Response('ok')},
            ADMIN_USER_IDS: 'admin@example.com'
        } as unknown as Env;
        const denied = await app.request('/api/admin/cards', {}, env);
        expect(denied.status).toBe(403);
        expect(await denied.json()).toMatchObject({error: 'FORBIDDEN', message: ADMIN_FORBIDDEN_MESSAGE});

        const unset = {
            ...env,
            ADMIN_USER_IDS: undefined,
            DB: {
                prepare() {
                    throw new Error('should not query');
                }
            }
        } as unknown as Env;
        expect((await app.request('/api/admin/cards', {}, unset)).status).toBe(403);
        expect((await app.request('/api/admin/cards', {}, {...unset, ADMIN_USER_IDS: '  ,  '})).status).toBe(403);
        expect(auditEntries(logSpy)).toEqual([]);
    });

    it('lists every card for an allowlisted user id and keeps personal history scoped', async () => {
        const env = createDb();
        const me = await app.request('/api/me', {}, env);
        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            id: 'user-admin',
            email: 'Admin@Example.com',
            name: '管理员',
            username: 'admin',
            isAdmin: true,
            streakDays: countStreakDays([
                '2026-10-25 03:00:00',
                '2026-10-25 02:00:00'
            ], new Date())
        });

        const first = await app.request('/api/admin/cards?page=1&pageSize=2', {}, env);
        expect(first.status).toBe(200);
        const pageOne = await first.json() as {
            items: Array<{
                id: string;
                userId: string;
                sentence: string;
                gloss: string;
                reading: string;
                audioUrl: string | null;
                illustrationUrl: string | null;
                createdAt: string;
                user: {id: string; email: string | null; name: string | null; username: string | null;};
            }>;
            pagination: {page: number; pageSize: number; total: number; totalPages: number;};
        };
        expect(pageOne.pagination).toEqual({page: 1, pageSize: 2, total: 4, totalPages: 2});
        expect(pageOne.items.map((item) => item.id)).toEqual(['card-new', 'card-mid']);
        expect(pageOne.items[0]).toMatchObject({
            id: 'card-new',
            userId: 'user-admin',
            sentence: '管理员的句子',
            gloss: '自己的意思',
            reading: 'かんり',
            audioUrl: 'https://example.com/admin.mp3',
            illustrationUrl: 'https://example.com/admin.png',
            createdAt: '2026-10-25 03:00:00',
            user: {
                id: 'user-admin',
                email: 'admin@example.com',
                name: '管理员',
                username: 'admin'
            }
        });
        expect(auditEntries(logSpy)).toEqual([
            expect.objectContaining({
                audit: 'admin.cards.list',
                adminId: 'user-admin',
                resultCount: 2
            })
        ]);
        const logged = auditEntries(logSpy)[0] as {timestamp: string;};
        expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(JSON.stringify(logged)).not.toContain('句子');
        expect(JSON.stringify(logged)).not.toContain('https://');

        const second = await app.request('/api/admin/cards?page=2&pageSize=2', {}, env);
        const pageTwo = await second.json() as {
            items: Array<{id: string; sentence: string; user: {id: string; email: string | null;};}>;
        };
        expect(pageTwo.items.map((item) => item.id)).toEqual(['card-old', 'card-orphan']);
        expect(pageTwo.items[0]).toMatchObject({
            sentence: '其他人的句子',
            user: {id: 'user-other', email: 'other@example.com'}
        });
        expect(pageTwo.items[1]).toMatchObject({
            sentence: '孤儿卡片',
            user: {id: 'missing-user', email: null, name: null, username: null}
        });

        const capped = await app.request('/api/admin/cards?pageSize=500', {}, env);
        const cappedBody = await capped.json() as {pagination: {pageSize: number; total: number;};};
        expect(cappedBody.pagination.pageSize).toBe(50);
        expect(cappedBody.pagination.total).toBe(4);

        const ownHistory = await app.request('/api/history?pageSize=20', {}, env);
        const own = await ownHistory.json() as {items: Array<{id: string; sentence: string;}>;};
        expect(own.items.map((item) => item.sentence)).toEqual(['管理员的句子', '中间的句子']);
        const otherDetail = await app.request('/api/history/card-old', {}, env);
        expect(otherDetail.status).toBe(404);

        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const write = await app.request('/api/admin/cards', {method}, env);
            expect(write.status).not.toBe(200);
            expect(write.status).not.toBe(204);
        }

        sessionState.user = {id: 'user-other', name: '其他人', email: 'other@example.com'};
        const otherHistory = await app.request('/api/history?pageSize=20', {}, env);
        const other = await otherHistory.json() as {items: Array<{sentence: string;}>;};
        expect(other.items.map((item) => item.sentence)).toEqual(['其他人的句子']);
        expect((await app.request('/api/admin/cards', {}, env)).status).toBe(403);
    });
});
