import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe, expect, it} from 'vitest';
import {QUOTA_COOLDOWN_MESSAGE, QUOTA_EXCEEDED_MESSAGE} from '../../userCopy.js';
import {
    CARD_GENERATION_INTERVAL_MS,
    DAILY_CARD_LIMIT,
    type QuotaExecutor,
    readCardQuotaWith,
    reserveCardQuotaWith
} from '../cardQuota.js';

const migrationSql = readFileSync(new URL('../../../migrations/0004_daily_card_quota.sql', import.meta.url), 'utf8');

function createQuotaDb () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migrationSql);
    const executor: QuotaExecutor = {
        async query(sql, params) {
            const statement = sqlite.prepare(sql);
            if (/^\s*select/i.test(sql)) {
                const rows = statement.all(...params).map((row) => ({...row}));
                return {rows, changes: 0};
            }
            const info = statement.run(...params);
            return {rows: [], changes: Number(info.changes)};
        }
    };
    return {sqlite, executor};
}

describe('daily card quota', () => {
    it('allows 20 cards in a Shanghai day and rejects the next one with the exhausted copy', async () => {
        const {executor} = createQuotaDb();
        const start = new Date('2026-10-25T02:00:00.000Z');

        for (let index = 0; index < DAILY_CARD_LIMIT; index += 1) {
            const reserved = await reserveCardQuotaWith(
                executor,
                'user-1',
                new Date(start.getTime() + index * CARD_GENERATION_INTERVAL_MS)
            );
            expect(reserved.ok).toBe(true);
            if (reserved.ok) {
                expect(reserved.quota.used).toBe(index + 1);
                expect(reserved.quota.remaining).toBe(DAILY_CARD_LIMIT - index - 1);
                expect(reserved.quota.limit).toBe(20);
            }
        }

        const denied = await reserveCardQuotaWith(
            executor,
            'user-1',
            new Date(start.getTime() + DAILY_CARD_LIMIT * CARD_GENERATION_INTERVAL_MS)
        );
        expect(denied).toMatchObject({
            ok: false,
            code: 'QUOTA_EXCEEDED',
            message: QUOTA_EXCEEDED_MESSAGE
        });
        if (!denied.ok) {
            expect(denied.quota).toEqual({
                limit: 20,
                used: 20,
                remaining: 0,
                resetsAt: '2026-10-25T16:00:00.000Z'
            });
        }

        const again = await reserveCardQuotaWith(
            executor,
            'user-1',
            new Date(start.getTime() + (DAILY_CARD_LIMIT + 2) * CARD_GENERATION_INTERVAL_MS)
        );
        expect(again.ok).toBe(false);
        const quota = await readCardQuotaWith(executor, 'user-1', start);
        expect(quota.used).toBe(20);
    });

    it('resets the counter at Asia/Shanghai midnight without dropping the 5 second gap', async () => {
        const {executor} = createQuotaDb();
        const last = new Date('2026-10-25T15:59:58.000Z');
        for (let index = 0; index < DAILY_CARD_LIMIT; index += 1) {
            const at = new Date(last.getTime() - (DAILY_CARD_LIMIT - 1 - index) * CARD_GENERATION_INTERVAL_MS);
            const reserved = await reserveCardQuotaWith(executor, 'user-1', at);
            expect(reserved.ok).toBe(true);
        }

        const stillToday = await readCardQuotaWith(executor, 'user-1', new Date('2026-10-25T15:59:59.999Z'));
        expect(stillToday.remaining).toBe(0);

        const crossed = new Date('2026-10-25T16:00:00.000Z');
        const opened = await readCardQuotaWith(executor, 'user-1', crossed);
        expect(opened).toEqual({
            limit: 20,
            used: 0,
            remaining: 20,
            resetsAt: '2026-10-26T16:00:00.000Z'
        });

        const tooSoon = await reserveCardQuotaWith(executor, 'user-1', crossed);
        expect(tooSoon).toMatchObject({ok: false, code: 'QUOTA_COOLDOWN', message: QUOTA_COOLDOWN_MESSAGE});
        expect((await readCardQuotaWith(executor, 'user-1', crossed)).used).toBe(0);

        const ready = await reserveCardQuotaWith(
            executor,
            'user-1',
            new Date(last.getTime() + CARD_GENERATION_INTERVAL_MS)
        );
        expect(ready.ok).toBe(true);
        if (ready.ok) {
            expect(ready.quota).toMatchObject({used: 1, remaining: 19, resetsAt: '2026-10-26T16:00:00.000Z'});
        }
    });

    it('requires at least 5 seconds between generations for the same user', async () => {
        const {executor} = createQuotaDb();
        const firstAt = new Date('2026-10-25T03:00:00.000Z');
        expect((await reserveCardQuotaWith(executor, 'user-1', firstAt)).ok).toBe(true);

        const tooSoon = await reserveCardQuotaWith(executor, 'user-1', new Date(firstAt.getTime() + 4999));
        expect(tooSoon).toMatchObject({ok: false, code: 'QUOTA_COOLDOWN', message: QUOTA_COOLDOWN_MESSAGE});
        expect((await readCardQuotaWith(executor, 'user-1', firstAt)).used).toBe(1);

        const allowed = await reserveCardQuotaWith(
            executor,
            'user-1',
            new Date(firstAt.getTime() + CARD_GENERATION_INTERVAL_MS)
        );
        expect(allowed.ok).toBe(true);
        if (allowed.ok) {
            expect(allowed.quota.used).toBe(2);
        }
    });

    it('does not share a quota across users and reading it does not consume a card', async () => {
        const {sqlite, executor} = createQuotaDb();
        const now = new Date('2026-10-25T04:00:00.000Z');
        expect((await reserveCardQuotaWith(executor, 'user-1', now)).ok).toBe(true);

        const before = sqlite.prepare('SELECT user_id, day_key, used, last_generated_at FROM daily_card_quota').all();
        const quota = await readCardQuotaWith(executor, 'user-2', now);
        const after = sqlite.prepare('SELECT user_id, day_key, used, last_generated_at FROM daily_card_quota').all();
        expect(quota).toEqual({
            limit: 20,
            used: 0,
            remaining: 20,
            resetsAt: '2026-10-25T16:00:00.000Z'
        });
        expect(after).toEqual(before);

        const other = await reserveCardQuotaWith(executor, 'user-2', now);
        expect(other.ok).toBe(true);
        expect((await readCardQuotaWith(executor, 'user-1', now)).used).toBe(1);
        expect((await readCardQuotaWith(executor, 'user-2', now)).used).toBe(1);
    });
});
