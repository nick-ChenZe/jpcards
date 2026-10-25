import {
    type CardHistoryRecord,
    getCardHistory,
    getCardHistoryById,
    getCardHistoryCount
} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {formatShanghaiTimestamp} from '../utils/shanghaiTime.js';
import {readingForSentence} from './practiceDeck.js';

export interface HistoryQuery {
    page?: string;
    pageSize?: string;
}

function normalizePagination (query: HistoryQuery): {page: number; pageSize: number; offset: number;} {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    return {
        page,
        pageSize,
        offset: (page - 1) * pageSize
    };
}

function hasKana (value: string): boolean {
    return /[\u3040-\u30ff]/.test(value);
}

function readingFromRuby (sentenceHtml: string): string {
    return [...sentenceHtml.matchAll(/<rt>([^<]*)<\/rt>/gi)]
        .map((match) =>
            match[1]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, '\'')
        )
        .filter(Boolean)
        .join(' ');
}

export function presentHistoryCard (card: CardHistoryRecord) {
    const stored = card.reading.trim();
    // 旧的本地练习卡可能只存了罗马音。词表里有假名时，用词表补上，不改数据库。
    const reading = stored && hasKana(stored)
        ? stored
        : readingForSentence(card.sentence) || stored || readingFromRuby(card.sentenceHtml);
    return {
        ...card,
        reading,
        createdAtText: formatShanghaiTimestamp(card.createdAt)
    };
}

export async function getHistoryResponse (db: AppDatabase, userId: string, query: HistoryQuery) {
    const {page, pageSize, offset} = normalizePagination(query);
    const [items, total] = await Promise.all([
        getCardHistory(db, userId, pageSize, offset),
        getCardHistoryCount(db, userId)
    ]);

    return {
        items: items.map(presentHistoryCard),
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}

export async function getHistoryCardResponse (db: AppDatabase, userId: string, cardId: string) {
    const card = await getCardHistoryById(db, userId, cardId);
    return card ? presentHistoryCard(card) : null;
}
