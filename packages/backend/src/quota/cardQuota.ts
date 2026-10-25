import type {AnyD1Database} from 'drizzle-orm/d1';
import {QUOTA_COOLDOWN_MESSAGE, QUOTA_EXCEEDED_MESSAGE} from '../userCopy.js';
import {type ShanghaiDayWindow, shanghaiDayWindow} from '../utils/shanghaiTime.js';

export const DAILY_CARD_LIMIT = 20;
export const CARD_GENERATION_INTERVAL_MS = 5000;

export interface QuotaSnapshot {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
}

export type QuotaDenialCode = 'QUOTA_EXCEEDED' | 'QUOTA_COOLDOWN';

export type ReserveCardQuotaResult =
    | {ok: true; quota: QuotaSnapshot;}
    | {ok: false; code: QuotaDenialCode; message: string; quota: QuotaSnapshot;};

interface QuotaQueryResult {
    rows: Array<Record<string, unknown>>;
    changes: number;
}

export interface QuotaExecutor {
    query(sql: string, params: Array<string | number>): Promise<QuotaQueryResult>;
}

interface QuotaRow {
    day_key: string;
    used: number;
    last_generated_at: number;
}

const READ_SQL = `
SELECT day_key, used, last_generated_at
FROM daily_card_quota
WHERE user_id = ?
`;

const RESERVE_SQL = `
INSERT INTO daily_card_quota (user_id, day_key, used, last_generated_at)
VALUES (?, ?, 1, ?)
ON CONFLICT(user_id) DO UPDATE SET
    day_key = excluded.day_key,
    used = CASE
        WHEN daily_card_quota.day_key = excluded.day_key THEN daily_card_quota.used + 1
        ELSE 1
    END,
    last_generated_at = excluded.last_generated_at
WHERE (? - daily_card_quota.last_generated_at) >= ?
    AND (
        daily_card_quota.day_key != excluded.day_key
        OR daily_card_quota.used < ?
    )
`;

// 失败时只退回当天次数。间隔仍由 last_generated_at 拦住，避免失败请求连点打模型。
const REFUND_SQL = `
UPDATE daily_card_quota
SET used = used - 1
WHERE user_id = ?
    AND day_key = ?
    AND used > 0
`;

export function quotaExecutorFromD1 (db: AnyD1Database): QuotaExecutor {
    return {
        async query(sql, params) {
            const result = await db.prepare(sql).bind(...params).run();
            return {
                rows: result.results ?? [],
                changes: result.meta?.changes ?? 0
            };
        }
    };
}

export async function readCardQuota (
    db: AnyD1Database,
    userId: string,
    now: Date = new Date()
): Promise<QuotaSnapshot> {
    return readCardQuotaWith(quotaExecutorFromD1(db), userId, now);
}

export async function reserveCardQuota (
    db: AnyD1Database,
    userId: string,
    now: Date = new Date()
): Promise<ReserveCardQuotaResult> {
    return reserveCardQuotaWith(quotaExecutorFromD1(db), userId, now);
}

export async function refundCardQuota (
    db: AnyD1Database,
    userId: string,
    now: Date = new Date()
): Promise<QuotaSnapshot> {
    return refundCardQuotaWith(quotaExecutorFromD1(db), userId, now);
}

export async function readCardQuotaWith (
    executor: QuotaExecutor,
    userId: string,
    now: Date = new Date()
): Promise<QuotaSnapshot> {
    const window = shanghaiDayWindow(now);
    const row = await readRow(executor, userId);
    return snapshot(window, row);
}

export async function reserveCardQuotaWith (
    executor: QuotaExecutor,
    userId: string,
    now: Date = new Date()
): Promise<ReserveCardQuotaResult> {
    const window = shanghaiDayWindow(now);
    const nowMs = now.getTime();
    const write = await executor.query(RESERVE_SQL, [
        userId,
        window.dayKey,
        nowMs,
        nowMs,
        CARD_GENERATION_INTERVAL_MS,
        DAILY_CARD_LIMIT
    ]);
    const row = await readRow(executor, userId);
    if (!row) {
        throw new Error('CARD_QUOTA_UNAVAILABLE');
    }
    const quota = snapshot(window, row);
    if (write.changes > 0) {
        return {ok: true, quota};
    }
    if (row.day_key === window.dayKey && row.used >= DAILY_CARD_LIMIT) {
        return {ok: false, code: 'QUOTA_EXCEEDED', message: QUOTA_EXCEEDED_MESSAGE, quota};
    }
    if (nowMs - row.last_generated_at < CARD_GENERATION_INTERVAL_MS) {
        return {ok: false, code: 'QUOTA_COOLDOWN', message: QUOTA_COOLDOWN_MESSAGE, quota};
    }
    return {ok: false, code: 'QUOTA_EXCEEDED', message: QUOTA_EXCEEDED_MESSAGE, quota};
}

export async function refundCardQuotaWith (
    executor: QuotaExecutor,
    userId: string,
    now: Date = new Date()
): Promise<QuotaSnapshot> {
    const window = shanghaiDayWindow(now);
    await executor.query(REFUND_SQL, [userId, window.dayKey]);
    return readCardQuotaWith(executor, userId, now);
}

async function readRow (executor: QuotaExecutor, userId: string): Promise<QuotaRow | null> {
    const result = await executor.query(READ_SQL, [userId]);
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return {
        day_key: String(row.day_key),
        used: Number(row.used),
        last_generated_at: Number(row.last_generated_at)
    };
}

function snapshot (window: ShanghaiDayWindow, row: QuotaRow | null): QuotaSnapshot {
    const used = row && row.day_key === window.dayKey ? Math.max(0, row.used) : 0;
    return {
        limit: DAILY_CARD_LIMIT,
        used,
        remaining: Math.max(0, DAILY_CARD_LIMIT - used),
        resetsAt: window.resetsAt
    };
}
