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
    return {
        ...card,
        reading: card.reading || readingForSentence(card.sentence) || readingFromRuby(card.sentenceHtml),
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
