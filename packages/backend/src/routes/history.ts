import {getCardHistory, getCardHistoryById, getCardHistoryCount} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';

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

export async function getHistoryResponse (db: AppDatabase, userId: string, query: HistoryQuery) {
    const {page, pageSize, offset} = normalizePagination(query);
    const [items, total] = await Promise.all([
        getCardHistory(db, userId, pageSize, offset),
        getCardHistoryCount(db, userId)
    ]);

    return {
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}

export async function getHistoryCardResponse (db: AppDatabase, userId: string, cardId: string) {
    return getCardHistoryById(db, userId, cardId);
}
