import {randomUUID} from 'crypto';
import {count, desc, eq, sql} from 'drizzle-orm';
import {db} from './d1Client.js';
import {cardHistory} from './schema.js';

export interface CardHistoryRecord {
    id: string;
    userId: string;
    sentence: string;
    sentenceHtml: string;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
}

export interface InsertCardHistoryInput {
    userId: string;
    sentence: string;
    sentenceHtml: string;
    audioUrl?: string;
    illustrationUrl?: string;
    level?: string;
}

/**
 * 插入一条卡片浏览记录，返回生成的 UUID
 */
export async function insertCardHistory (input: InsertCardHistoryInput): Promise<string> {
    const id = randomUUID();
    await db.insert(cardHistory).values({
        id,
        userId: input.userId,
        sentence: input.sentence,
        sentenceHtml: input.sentenceHtml,
        audioUrl: input.audioUrl ?? null,
        illustrationUrl: input.illustrationUrl ?? null,
        level: input.level ?? 'N5'
    });
    return id;
}

/**
 * 更新卡片的音频和插图 URL
 */
export async function updateCardAssets (
    cardId: string,
    audioUrl: string,
    illustrationUrl: string
): Promise<void> {
    await db.update(cardHistory)
        .set({audioUrl, illustrationUrl})
        .where(eq(cardHistory.id, cardId));
}

/**
 * 获取用户的卡片浏览历史（分页）
 */
export async function getCardHistory (
    userId: string,
    limit: number = 20,
    offset: number = 0
): Promise<CardHistoryRecord[]> {
    const rows = await db.select()
        .from(cardHistory)
        .where(eq(cardHistory.userId, userId))
        .orderBy(desc(cardHistory.createdAt))
        .limit(limit)
        .offset(offset);

    return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        sentence: row.sentence,
        sentenceHtml: row.sentenceHtml,
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? ''
    }));
}

/**
 * 获取用户的卡片总数
 */
export async function getCardHistoryCount (userId: string): Promise<number> {
    const result = await db.select({total: count()})
        .from(cardHistory)
        .where(eq(cardHistory.userId, userId));

    return result[0]?.total ?? 0;
}
