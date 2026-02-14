import {getCardHistory, getCardHistoryCount} from '../database/cardHistory.js';

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

export async function getHistoryResponse (userId: string, query: HistoryQuery) {
    const {page, pageSize, offset} = normalizePagination(query);
    const [items, total] = await Promise.all([
        getCardHistory(userId, pageSize, offset),
        getCardHistoryCount(userId)
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
