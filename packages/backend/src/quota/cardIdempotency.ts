import type {AnyD1Database} from 'drizzle-orm/d1';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

const CLAIM_SQL = `
INSERT INTO card_generation_idempotency (user_id, idempotency_key, state, created_at)
VALUES (?, ?, 'pending', ?)
ON CONFLICT(user_id, idempotency_key) DO NOTHING
`;

const READ_SQL = `
SELECT state, http_status, response_json
FROM card_generation_idempotency
WHERE user_id = ? AND idempotency_key = ?
`;

const COMPLETE_SQL = `
UPDATE card_generation_idempotency
SET state = 'completed', http_status = ?, response_json = ?
WHERE user_id = ? AND idempotency_key = ? AND state = 'pending'
`;

export type CardGenerationClaim =
    | {kind: 'owned';}
    | {kind: 'in_progress';}
    | {kind: 'replay'; httpStatus: number; body: Record<string, unknown>;}
    | {kind: 'unreadable';};

interface IdempotencyRow {
    state: string;
    http_status: number | null;
    response_json: string | null;
}

/** 一次用户动作一把钥匙。空的、过短或带空白的编号直接拒绝，避免无法去重的预扣。 */
export function normalizeIdempotencyKey (value: string | undefined): string | null {
    const key = value?.trim() ?? '';
    if (!KEY_PATTERN.test(key)) {
        return null;
    }
    return key;
}

export async function claimCardGeneration (
    db: AnyD1Database,
    userId: string,
    key: string,
    now: Date
): Promise<CardGenerationClaim> {
    const write = await run(db, CLAIM_SQL, [userId, key, now.getTime()]);
    if (write.changes > 0) {
        return {kind: 'owned'};
    }
    const row = await readRow(db, userId, key);
    if (!row) {
        throw new Error('CARD_IDEMPOTENCY_UNAVAILABLE');
    }
    if (row.state === 'pending') {
        return {kind: 'in_progress'};
    }
    const replay = parseReplay(row);
    if (!replay) {
        return {kind: 'unreadable'};
    }
    return {kind: 'replay', httpStatus: replay.httpStatus, body: replay.body};
}

export async function completeCardGeneration (
    db: AnyD1Database,
    userId: string,
    key: string,
    httpStatus: number,
    body: Record<string, unknown>
): Promise<void> {
    await run(db, COMPLETE_SQL, [httpStatus, JSON.stringify(body), userId, key]);
}

async function readRow (db: AnyD1Database, userId: string, key: string): Promise<IdempotencyRow | null> {
    const result = await run(db, READ_SQL, [userId, key]);
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    const status = row.http_status;
    return {
        state: String(row.state),
        http_status: status === null || status === undefined ? null : Number(status),
        response_json: typeof row.response_json === 'string' ? row.response_json : null
    };
}

function parseReplay (row: IdempotencyRow): {httpStatus: number; body: Record<string, unknown>;} | null {
    if (row.state !== 'completed' || row.http_status === null || row.response_json === null) {
        return null;
    }
    if (!Number.isInteger(row.http_status) || row.http_status < 200 || row.http_status > 599) {
        return null;
    }
    try {
        const body: unknown = JSON.parse(row.response_json);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return null;
        }
        return {httpStatus: row.http_status, body: body as Record<string, unknown>};
    } catch {
        return null;
    }
}

async function run (
    db: AnyD1Database,
    sql: string,
    params: Array<string | number>
): Promise<{rows: Array<Record<string, unknown>>; changes: number;}> {
    const result = await db.prepare(sql).bind(...params).run();
    return {
        rows: result.results ?? [],
        changes: result.meta?.changes ?? 0
    };
}
