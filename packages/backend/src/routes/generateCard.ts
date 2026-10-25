import type {AnyD1Database} from 'drizzle-orm/d1';
import {createDb} from '../database/db.js';
import {claimCardGeneration, completeCardGeneration, normalizeIdempotencyKey} from '../quota/cardIdempotency.js';
import {type QuotaSnapshot, readCardQuota, refundCardQuota, reserveCardQuota} from '../quota/cardQuota.js';
import type {Env} from '../types.js';
import {CARD_IN_PROGRESS_MESSAGE, IDEMPOTENCY_KEY_REQUIRED_MESSAGE} from '../userCopy.js';
import {buildCardWithMemory, type CardDemoResult} from './card.js';
import {CardGlossError} from './cardGlossError.js';

const GENERATION_FAILED = {
    error: 'CARD_GEN_FAILED',
    message: '生成失败，请稍后再试。'
} as const;

export interface GenerateCardResult {
    status: number;
    body: Record<string, unknown>;
}

export async function generateCard (input: {
    database: AnyD1Database;
    userId: string;
    env: Env;
    assetsBaseUrl: string;
    idempotencyKey: string | undefined;
    now?: Date;
}): Promise<GenerateCardResult> {
    const now = input.now ?? new Date();
    const key = normalizeIdempotencyKey(input.idempotencyKey);
    if (!key) {
        return {
            status: 400,
            body: {error: 'IDEMPOTENCY_KEY_REQUIRED', message: IDEMPOTENCY_KEY_REQUIRED_MESSAGE}
        };
    }

    let claim;
    try {
        claim = await claimCardGeneration(input.database, input.userId, key, now);
    } catch (error) {
        console.error('Failed to claim card generation', error);
        return {status: 500, body: {...GENERATION_FAILED}};
    }

    if (claim.kind === 'replay') {
        return {status: claim.httpStatus, body: claim.body};
    }
    if (claim.kind === 'in_progress') {
        return {status: 409, body: {error: 'CARD_IN_PROGRESS', message: CARD_IN_PROGRESS_MESSAGE}};
    }
    if (claim.kind !== 'owned') {
        console.error('Card idempotency record is unreadable');
        return {status: 500, body: {...GENERATION_FAILED}};
    }

    let charged = false;
    try {
        const reserved = await reserveCardQuota(input.database, input.userId, now);
        if (!reserved.ok) {
            const body = {error: reserved.code, message: reserved.message};
            await remember(input.database, input.userId, key, 429, body);
            return {status: 429, body};
        }
        charged = true;
        const card = await buildCardWithMemory({
            db: createDb(input.database),
            userId: input.userId,
            env: input.env,
            assetsBaseUrl: input.assetsBaseUrl
        });
        charged = false;
        const body = await cardBody(input.database, input.userId, now, card.card);
        await remember(input.database, input.userId, key, 200, body);
        return {status: 200, body};
    } catch (error) {
        if (charged) {
            try {
                await refundCardQuota(input.database, input.userId, now);
            } catch (refundError) {
                console.error('Failed to refund card quota', refundError);
            }
        }
        if (error instanceof CardGlossError) {
            const body = {error: error.code, message: error.message};
            await remember(input.database, input.userId, key, 422, body);
            return {status: 422, body};
        }
        console.error('Failed to build card', error);
        const body = {...GENERATION_FAILED};
        await remember(input.database, input.userId, key, 500, body);
        return {status: 500, body};
    }
}

async function cardBody (
    database: AnyD1Database,
    userId: string,
    now: Date,
    card: CardDemoResult
): Promise<Record<string, unknown>> {
    let quota: QuotaSnapshot | undefined;
    try {
        quota = await readCardQuota(database, userId, now);
    } catch (error) {
        console.error('Failed to read quota after card generation', error);
    }
    return quota ? {...card, quota} : {...card};
}

async function remember (
    database: AnyD1Database,
    userId: string,
    key: string,
    status: number,
    body: Record<string, unknown>
): Promise<void> {
    try {
        await completeCardGeneration(database, userId, key, status, body);
    } catch (error) {
        console.error('Failed to store card idempotency result', error);
    }
}
