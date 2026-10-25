import {randomUUID} from 'crypto';
import {and, count, desc, eq} from 'drizzle-orm';
import {parseStoredReadingTokens, type ReadingToken, serializeReadingTokens} from '../utils/readingHighlight.js';
import type {AppDatabase} from './db.js';
import {cardHistory, user} from './schema.js';

export interface CardHistoryRecord {
    id: string;
    userId: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    reading: string;
    readingTokens: ReadingToken[] | null;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
}

export interface AdminCardRecord extends CardHistoryRecord {
    userEmail: string | null;
    userName: string | null;
    username: string | null;
}

export interface InsertCardHistoryInput {
    userId: string;
    sentence: string;
    sentenceHtml: string;
    gloss?: string;
    reading?: string;
    readingTokens?: ReadingToken[] | null;
    audioUrl?: string | null;
    illustrationUrl?: string | null;
    level?: string;
}

export async function insertCardHistory (db: AppDatabase, input: InsertCardHistoryInput): Promise<string> {
    const id = randomUUID();
    await db.insert(cardHistory).values({
        id,
        userId: input.userId,
        sentence: input.sentence,
        sentenceHtml: input.sentenceHtml,
        gloss: input.gloss ?? '',
        reading: input.reading ?? '',
        readingTokens: serializeReadingTokens(input.readingTokens),
        audioUrl: input.audioUrl ?? null,
        illustrationUrl: input.illustrationUrl ?? null,
        level: input.level ?? 'N5'
    });
    return id;
}

export async function updateCardAudio (
    db: AppDatabase,
    cardId: string,
    userId: string,
    audioUrl: string
): Promise<void> {
    await db.update(cardHistory)
        .set({audioUrl})
        .where(and(eq(cardHistory.id, cardId), eq(cardHistory.userId, userId)));
}

export async function updateCardIllustration (
    db: AppDatabase,
    cardId: string,
    userId: string,
    illustrationUrl: string
): Promise<void> {
    await db.update(cardHistory)
        .set({illustrationUrl})
        .where(and(eq(cardHistory.id, cardId), eq(cardHistory.userId, userId)));
}

export async function updateCardAssets (
    db: AppDatabase,
    cardId: string,
    audioUrl: string,
    illustrationUrl: string
): Promise<void> {
    await db.update(cardHistory)
        .set({audioUrl, illustrationUrl})
        .where(eq(cardHistory.id, cardId));
}

export async function getCardHistory (
    db: AppDatabase,
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
        gloss: row.gloss ?? '',
        reading: row.reading ?? '',
        readingTokens: parseStoredReadingTokens(row.readingTokens),
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? ''
    }));
}

export async function listAllCards (
    db: AppDatabase,
    limit: number = 20,
    offset: number = 0
): Promise<AdminCardRecord[]> {
    const rows = await db.select({
        id: cardHistory.id,
        userId: cardHistory.userId,
        sentence: cardHistory.sentence,
        sentenceHtml: cardHistory.sentenceHtml,
        gloss: cardHistory.gloss,
        reading: cardHistory.reading,
        readingTokens: cardHistory.readingTokens,
        audioUrl: cardHistory.audioUrl,
        illustrationUrl: cardHistory.illustrationUrl,
        level: cardHistory.level,
        createdAt: cardHistory.createdAt,
        userEmail: user.email,
        userName: user.name,
        username: user.username
    })
        .from(cardHistory)
        .leftJoin(user, eq(cardHistory.userId, user.id))
        .orderBy(desc(cardHistory.createdAt), desc(cardHistory.id))
        .limit(limit)
        .offset(offset);

    return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        sentence: row.sentence,
        sentenceHtml: row.sentenceHtml,
        gloss: row.gloss ?? '',
        reading: row.reading ?? '',
        readingTokens: parseStoredReadingTokens(row.readingTokens),
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? '',
        userEmail: row.userEmail ?? null,
        userName: row.userName ?? null,
        username: row.username ?? null
    }));
}

export async function countAllCards (db: AppDatabase): Promise<number> {
    const result = await db.select({total: count()})
        .from(cardHistory);
    return result[0]?.total ?? 0;
}

export async function getCardHistoryCount (db: AppDatabase, userId: string): Promise<number> {
    const result = await db.select({total: count()})
        .from(cardHistory)
        .where(eq(cardHistory.userId, userId));

    return result[0]?.total ?? 0;
}

export async function getCardHistoryById (
    db: AppDatabase,
    userId: string,
    cardId: string
): Promise<CardHistoryRecord | null> {
    const rows = await db.select()
        .from(cardHistory)
        .where(and(eq(cardHistory.id, cardId), eq(cardHistory.userId, userId)))
        .limit(1);
    const row = rows[0];
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        userId: row.userId,
        sentence: row.sentence,
        sentenceHtml: row.sentenceHtml,
        gloss: row.gloss ?? '',
        reading: row.reading ?? '',
        readingTokens: parseStoredReadingTokens(row.readingTokens),
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? ''
    };
}

/** 最近卡片的入库时间，供连签按北京时间自然日计算。不改表。 */
export async function listRecentCardCreatedAt (
    db: AppDatabase,
    userId: string,
    limit: number = 2000
): Promise<string[]> {
    const rows = await db.select({createdAt: cardHistory.createdAt})
        .from(cardHistory)
        .where(eq(cardHistory.userId, userId))
        .orderBy(desc(cardHistory.createdAt))
        .limit(limit);
    return rows.map((row) => row.createdAt ?? '').filter((value) => value.length > 0);
}
