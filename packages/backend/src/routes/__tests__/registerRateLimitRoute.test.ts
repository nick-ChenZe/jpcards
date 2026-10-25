import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {REGISTER_RATE_LIMIT_MESSAGE, REGISTER_UNAVAILABLE_MESSAGE} from '../../userCopy.js';

const authState = vi.hoisted(() => ({
    handler: vi.fn(async (request: Request) => {
        const raw = await request.clone().text();
        return Response.json({ok: true, raw});
    })
}));

vi.mock('../auth.js', () => ({
    AuthConfigError: class AuthConfigError extends Error {},
    auth: () => ({
        handler: (request: Request) => authState.handler(request),
        api: {
            getSession: async () => null
        }
    })
}));

import {REGISTER_IP_LIMIT} from '../../auth/registerRateLimit.js';
import app from '../../index.js';

const migrationSql = readFileSync(
    new URL('../../../migrations/0007_register_rate_limit.sql', import.meta.url),
    'utf8'
);
const LEAK_MARKER = 'secret-LEAK-MARKER';

function createEnv (options?: {fail?: boolean;}) {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    const db = {
        prepare(query: string) {
            if (options?.fail) {
                throw new Error(`${LEAK_MARKER} at registerRateLimit.ts:1\n    at hidden stack`);
            }
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
                        },
                        async all() {
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
            BETTER_AUTH_SECRET: LEAK_MARKER
        } as unknown as Env
    };
}

function signUp (env: Env, ip: string | null, email: string, extraHeaders?: Record<string, string>) {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...extraHeaders
    };
    if (ip) {
        headers['cf-connecting-ip'] = ip;
    }
    return app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            email,
            password: LEAK_MARKER,
            name: '测试',
            username: 'tester'
        })
    }, env);
}

describe('register rate limit route', () => {
    beforeEach(() => {
        authState.handler.mockClear();
    });

    it('stops the sixth signup from the same IP and does not call auth or echo secrets', async () => {
        const {env} = createEnv();
        for (let index = 0; index < REGISTER_IP_LIMIT; index += 1) {
            const response = await signUp(env, '203.0.113.10', `ok-${index}@example.com`);
            expect(response.status).toBe(200);
            const body = await response.json() as {raw: string;};
            expect(body.raw).toContain(`ok-${index}@example.com`);
        }
        expect(authState.handler).toHaveBeenCalledTimes(REGISTER_IP_LIMIT);

        const denied = await signUp(env, '203.0.113.10', 'blocked@example.com', {
            'x-forwarded-for': '198.51.100.77'
        });
        expect(denied.status).toBe(429);
        expect(denied.headers.get('retry-after')).toMatch(/^[1-9][0-9]*$/);
        const deniedText = await denied.text();
        expect(JSON.parse(deniedText)).toEqual({
            error: 'REGISTER_RATE_LIMITED',
            code: 'REGISTER_RATE_LIMITED',
            message: REGISTER_RATE_LIMIT_MESSAGE
        });
        expect(authState.handler).toHaveBeenCalledTimes(REGISTER_IP_LIMIT);
        expect(deniedText).not.toContain(LEAK_MARKER);
        expect(deniedText.toLowerCase()).not.toContain('stack');
    });

    it('does not rate limit sign-in', async () => {
        const {env} = createEnv();
        for (let index = 0; index < REGISTER_IP_LIMIT + 2; index += 1) {
            const response = await app.request('/api/auth/sign-in/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'cf-connecting-ip': '203.0.113.10'
                },
                body: JSON.stringify({email: 'user@example.com', password: LEAK_MARKER})
            }, env);
            expect(response.status).toBe(200);
        }
        expect(authState.handler).toHaveBeenCalledTimes(REGISTER_IP_LIMIT + 2);
    });

    it('returns a generic 503 when the counter cannot be written', async () => {
        const {env} = createEnv({fail: true});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const response = await signUp(env, '203.0.113.10', 'user@example.com');
            expect(response.status).toBe(503);
            const text = await response.text();
            expect(JSON.parse(text)).toEqual({
                error: 'REGISTER_UNAVAILABLE',
                message: REGISTER_UNAVAILABLE_MESSAGE
            });
            expect(text).not.toContain(LEAK_MARKER);
            expect(text).not.toContain('registerRateLimit.ts');
            expect(authState.handler).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            errorSpy.mockRestore();
        }
    });
});
