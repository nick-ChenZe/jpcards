import type {AnyD1Database} from 'drizzle-orm/d1';
import {REGISTER_RATE_LIMIT_MESSAGE} from '../userCopy.js';

/** 从该 IP 或该邮箱的第一次尝试起算，不是整点对齐。 */
export const REGISTER_WINDOW_MS = 10 * 60 * 1000;
export const REGISTER_IP_LIMIT = 5;
export const REGISTER_EMAIL_LIMIT = 5;

const MAX_EMAIL_LENGTH = 320;
const MAX_IP_LENGTH = 128;
const MAX_REGISTER_BODY_BYTES = 16 * 1024;

export interface RegisterRateExecutor {
    query(sql: string, params: Array<string | number>): Promise<{
        rows: Array<Record<string, unknown>>;
        changes: number;
    }>;
}

export interface RegisterAttemptInput {
    ip: string | null;
    email: string | null;
    now?: Date;
}

export type RegisterRateDecision =
    | {ok: true;}
    | {
        ok: false;
        code: 'REGISTER_RATE_LIMITED';
        message: string;
        scope: 'ip' | 'email' | 'unattributed';
        retryAfterSeconds: number;
    };

interface BucketRow {
    window_start: number;
    count: number;
}

const PRUNE_SQL = `
DELETE FROM register_rate_limit
WHERE window_start < ?
`;

const UPSERT_SQL = `
INSERT INTO register_rate_limit (scope, bucket_key, window_start, count)
VALUES (?, ?, ?, 1)
ON CONFLICT(scope, bucket_key) DO UPDATE SET
    window_start = CASE
        WHEN (? - register_rate_limit.window_start) >= ? THEN ?
        ELSE register_rate_limit.window_start
    END,
    count = CASE
        WHEN (? - register_rate_limit.window_start) >= ? THEN 1
        ELSE register_rate_limit.count + 1
    END
WHERE (? - register_rate_limit.window_start) >= ?
    OR register_rate_limit.count < ?
`;

const READ_SQL = `
SELECT window_start, count
FROM register_rate_limit
WHERE scope = ?
    AND bucket_key = ?
`;

export function registerRateExecutorFromD1 (db: AnyD1Database): RegisterRateExecutor {
    return {
        async query(sql, params) {
            const statement = db.prepare(sql).bind(...params);
            if (/^\s*select/i.test(sql)) {
                const result = await statement.all();
                return {
                    rows: result.results ?? [],
                    changes: 0
                };
            }
            const result = await statement.run();
            const changes = result.meta?.changes;
            if (typeof changes !== 'number') {
                throw new Error('REGISTER_RATE_LIMIT_UNAVAILABLE');
            }
            return {
                rows: [],
                changes
            };
        }
    };
}

export function isRegisterRequest (method: string, path: string): boolean {
    if (method.toUpperCase() !== 'POST') {
        return false;
    }
    const pathname = path.split('?')[0]?.replace(/\/+$/, '') ?? '';
    return pathname === '/api/auth/sign-up/email';
}

export function normalizeRegisterEmail (raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim().toLowerCase();
    if (!value) {
        return null;
    }
    return value.length > MAX_EMAIL_LENGTH ? value.slice(0, MAX_EMAIL_LENGTH) : value;
}

export function normalizeClientIp (raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!value) {
        return null;
    }
    return value.length > MAX_IP_LENGTH ? value.slice(0, MAX_IP_LENGTH) : value;
}

/** 只认 Cloudflare 写入的 CF-Connecting-IP。不读 X-Forwarded-For，避免客户端伪造。 */
export function clientIpFromHeaders (headers: Headers): string | null {
    return normalizeClientIp(headers.get('cf-connecting-ip'));
}

export async function readRegisterEmail (request: Request): Promise<string | null> {
    const advertised = Number(request.headers.get('content-length') ?? '');
    if (Number.isFinite(advertised) && advertised > MAX_REGISTER_BODY_BYTES) {
        return null;
    }
    try {
        const body = await request.clone().json() as {email?: unknown;};
        return normalizeRegisterEmail(typeof body.email === 'string' ? body.email : null);
    } catch {
        return null;
    }
}

export async function consumeRegisterAttempt (
    db: AnyD1Database,
    input: RegisterAttemptInput
): Promise<RegisterRateDecision> {
    return consumeRegisterAttemptWith(registerRateExecutorFromD1(db), input);
}

export async function consumeRegisterAttemptWith (
    executor: RegisterRateExecutor,
    input: RegisterAttemptInput
): Promise<RegisterRateDecision> {
    const nowMs = (input.now ?? new Date()).getTime();
    const ip = normalizeClientIp(input.ip);
    const email = normalizeRegisterEmail(input.email);
    await executor.query(PRUNE_SQL, [nowMs - REGISTER_WINDOW_MS]);

    if (!ip && !email) {
        return denied('unattributed', Math.ceil(REGISTER_WINDOW_MS / 1000));
    }

    if (ip) {
        const ipAttempt = await consumeBucket(executor, 'ip', ip, REGISTER_IP_LIMIT, nowMs);
        if (!ipAttempt.ok) {
            return denied('ip', ipAttempt.retryAfterSeconds);
        }
    }

    if (email) {
        const emailAttempt = await consumeBucket(executor, 'email', email, REGISTER_EMAIL_LIMIT, nowMs);
        if (!emailAttempt.ok) {
            return denied('email', emailAttempt.retryAfterSeconds);
        }
    }

    return {ok: true};
}

async function consumeBucket (
    executor: RegisterRateExecutor,
    scope: 'ip' | 'email',
    key: string,
    limit: number,
    nowMs: number
): Promise<{ok: true;} | {ok: false; retryAfterSeconds: number;}> {
    const write = await executor.query(UPSERT_SQL, [
        scope,
        key,
        nowMs,
        nowMs,
        REGISTER_WINDOW_MS,
        nowMs,
        nowMs,
        REGISTER_WINDOW_MS,
        nowMs,
        REGISTER_WINDOW_MS,
        limit
    ]);
    if (write.changes > 0) {
        return {ok: true};
    }
    const row = await readBucket(executor, scope, key);
    const retryAfterSeconds = row
        ? secondsUntil(nowMs, row.window_start + REGISTER_WINDOW_MS)
        : Math.ceil(REGISTER_WINDOW_MS / 1000);
    return {ok: false, retryAfterSeconds};
}

async function readBucket (
    executor: RegisterRateExecutor,
    scope: 'ip' | 'email',
    key: string
): Promise<BucketRow | null> {
    const result = await executor.query(READ_SQL, [scope, key]);
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return {
        window_start: Number(row.window_start),
        count: Number(row.count)
    };
}

function denied (
    scope: 'ip' | 'email' | 'unattributed',
    retryAfterSeconds: number
): RegisterRateDecision {
    return {
        ok: false,
        code: 'REGISTER_RATE_LIMITED',
        message: REGISTER_RATE_LIMIT_MESSAGE,
        scope,
        retryAfterSeconds
    };
}

function secondsUntil (nowMs: number, atMs: number): number {
    return Math.max(1, Math.ceil((atMs - nowMs) / 1000));
}
