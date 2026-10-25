import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe, expect, it} from 'vitest';
import {REGISTER_RATE_LIMIT_MESSAGE} from '../../userCopy.js';
import {
    clientIpFromHeaders,
    consumeRegisterAttemptWith,
    isRegisterRequest,
    normalizeRegisterEmail,
    readRegisterEmail,
    REGISTER_EMAIL_LIMIT,
    REGISTER_IP_LIMIT,
    REGISTER_WINDOW_MS,
    type RegisterRateExecutor
} from '../registerRateLimit.js';

const migrationSql = readFileSync(
    new URL('../../../migrations/0007_register_rate_limit.sql', import.meta.url),
    'utf8'
);

function createRegisterDb () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    const executor: RegisterRateExecutor = {
        async query(sql, params) {
            const statement = sqlite.prepare(sql);
            if (/^\s*(select|delete)/i.test(sql)) {
                if (/^\s*select/i.test(sql)) {
                    const rows = statement.all(...params).map((row) => ({...row}));
                    return {rows, changes: 0};
                }
                const info = statement.run(...params);
                return {rows: [], changes: Number(info.changes)};
            }
            const info = statement.run(...params);
            return {rows: [], changes: Number(info.changes)};
        }
    };
    return {sqlite, executor};
}

function countFor (sqlite: DatabaseSync, scope: string, key: string): number | null {
    const row = sqlite.prepare(
        'SELECT count FROM register_rate_limit WHERE scope = ? AND bucket_key = ?'
    ).get(scope, key) as {count: number;} | undefined;
    return row ? row.count : null;
}

describe('register rate limit', () => {
    const start = new Date('2026-10-25T02:00:00.000Z');

    it('allows five signups from one IP, then rejects without raising the counter', async () => {
        const {sqlite, executor} = createRegisterDb();

        for (let index = 0; index < REGISTER_IP_LIMIT; index += 1) {
            const decision = await consumeRegisterAttemptWith(executor, {
                ip: '203.0.113.10',
                email: `person-${index}@example.com`,
                now: new Date(start.getTime() + index * 1000)
            });
            expect(decision.ok).toBe(true);
        }

        const denied = await consumeRegisterAttemptWith(executor, {
            ip: '203.0.113.10',
            email: 'sixth@example.com',
            now: new Date(start.getTime() + 6000)
        });
        expect(denied).toMatchObject({
            ok: false,
            code: 'REGISTER_RATE_LIMITED',
            message: REGISTER_RATE_LIMIT_MESSAGE,
            scope: 'ip'
        });
        if (!denied.ok) {
            expect(denied.retryAfterSeconds).toBeGreaterThan(1);
            expect(denied.retryAfterSeconds).toBeLessThanOrEqual(REGISTER_WINDOW_MS / 1000);
        }
        expect(countFor(sqlite, 'ip', '203.0.113.10')).toBe(REGISTER_IP_LIMIT);
        expect(countFor(sqlite, 'email', 'sixth@example.com')).toBeNull();
    });

    it('limits the same email across IPs and treats case and surrounding space as the same mailbox', async () => {
        const {sqlite, executor} = createRegisterDb();

        for (let index = 0; index < REGISTER_EMAIL_LIMIT; index += 1) {
            const email = index % 2 === 0 ? 'User@Example.com' : '  user@example.com  ';
            const decision = await consumeRegisterAttemptWith(executor, {
                ip: `203.0.113.${index + 1}`,
                email,
                now: new Date(start.getTime() + index * 1000)
            });
            expect(decision.ok).toBe(true);
        }

        const denied = await consumeRegisterAttemptWith(executor, {
            ip: '203.0.113.40',
            email: 'USER@example.com',
            now: new Date(start.getTime() + 7000)
        });
        expect(denied).toMatchObject({ok: false, scope: 'email'});
        expect(countFor(sqlite, 'email', 'user@example.com')).toBe(REGISTER_EMAIL_LIMIT);
        expect(countFor(sqlite, 'ip', '203.0.113.40')).toBe(1);
    });

    it('opens a new window ten minutes after that key first tried, and drops expired rows', async () => {
        const {sqlite, executor} = createRegisterDb();
        for (let index = 0; index < REGISTER_IP_LIMIT; index += 1) {
            await consumeRegisterAttemptWith(executor, {
                ip: '203.0.113.10',
                email: `again-${index}@example.com`,
                now: start
            });
        }
        sqlite.prepare(
            'INSERT INTO register_rate_limit (scope, bucket_key, window_start, count) VALUES (?, ?, ?, ?)'
        ).run('ip', '198.51.100.4', start.getTime() - REGISTER_WINDOW_MS - 1, 5);

        const stillBlocked = await consumeRegisterAttemptWith(executor, {
            ip: '203.0.113.10',
            email: 'fresh@example.com',
            now: new Date(start.getTime() + REGISTER_WINDOW_MS - 1)
        });
        expect(stillBlocked.ok).toBe(false);

        const reopened = await consumeRegisterAttemptWith(executor, {
            ip: '203.0.113.10',
            email: 'fresh@example.com',
            now: new Date(start.getTime() + REGISTER_WINDOW_MS)
        });
        expect(reopened.ok).toBe(true);
        expect(countFor(sqlite, 'ip', '203.0.113.10')).toBe(1);
        expect(countFor(sqlite, 'ip', '198.51.100.4')).toBeNull();
    });

    it('does not let a missing IP skip the email limit, and rejects an attempt with neither', async () => {
        const {sqlite, executor} = createRegisterDb();
        for (let index = 0; index < REGISTER_EMAIL_LIMIT; index += 1) {
            const decision = await consumeRegisterAttemptWith(executor, {
                ip: null,
                email: 'solo@example.com',
                now: start
            });
            expect(decision.ok).toBe(true);
        }
        const denied = await consumeRegisterAttemptWith(executor, {
            ip: '   ',
            email: 'solo@example.com',
            now: start
        });
        expect(denied).toMatchObject({ok: false, scope: 'email'});

        const anonymous = await consumeRegisterAttemptWith(executor, {
            ip: null,
            email: '   ',
            now: start
        });
        expect(anonymous).toMatchObject({
            ok: false,
            scope: 'unattributed',
            message: REGISTER_RATE_LIMIT_MESSAGE
        });
        const rows = sqlite.prepare('SELECT scope, bucket_key FROM register_rate_limit').all();
        expect(rows).toEqual([{scope: 'email', bucket_key: 'solo@example.com'}]);
    });

    it('keeps concurrent attempts inside the IP cap', async () => {
        const {executor} = createRegisterDb();
        const decisions = await Promise.all(
            Array.from({length: REGISTER_IP_LIMIT + 4}, (_item, index) =>
                consumeRegisterAttemptWith(executor, {
                    ip: '203.0.113.10',
                    email: `burst-${index}@example.com`,
                    now: start
                }))
        );
        const allowed = decisions.filter((decision) => decision.ok);
        expect(allowed).toHaveLength(REGISTER_IP_LIMIT);
    });

    it('recognizes only the email sign-up POST and only the Cloudflare client IP', () => {
        expect(isRegisterRequest('POST', '/api/auth/sign-up/email')).toBe(true);
        expect(isRegisterRequest('post', '/api/auth/sign-up/email/?next=1')).toBe(true);
        expect(isRegisterRequest('POST', '/api/auth/sign-in/email')).toBe(false);
        expect(isRegisterRequest('GET', '/api/auth/sign-up/email')).toBe(false);

        const headers = new Headers({
            'CF-Connecting-IP': ' 203.0.113.8 ',
            'X-Forwarded-For': '198.51.100.9'
        });
        expect(clientIpFromHeaders(headers)).toBe('203.0.113.8');
        expect(clientIpFromHeaders(new Headers({'X-Forwarded-For': '198.51.100.9'}))).toBeNull();
        expect(normalizeRegisterEmail('  A@B.COM ')).toBe('a@b.com');
    });

    it('does not parse an oversized signup body', async () => {
        const request = new Request('https://jpcards.example/api/auth/sign-up/email', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'content-length': '20000'
            },
            body: JSON.stringify({email: 'big@example.com', password: 'secret-LEAK-MARKER'})
        });
        await expect(readRegisterEmail(request)).resolves.toBeNull();
    });
});
