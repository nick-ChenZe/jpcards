import {randomUUID} from 'crypto';
import {and, count, desc, eq} from 'drizzle-orm';
import type {AppDatabase} from './db.js';
import {cardHistory} from './schema.js';

export interface CardHistoryRecord {
    id: string;
    userId: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
}

export interface InsertCardHistoryInput {
    userId: string;
    sentence: string;
    sentenceHtml: string;
    gloss?: string;
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
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? ''
    }));
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
        audioUrl: row.audioUrl,
        illustrationUrl: row.illustrationUrl,
        level: row.level ?? 'N5',
        createdAt: row.createdAt ?? ''
    };
}
