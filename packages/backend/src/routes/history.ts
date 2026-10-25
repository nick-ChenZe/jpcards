import {
    type CardHistoryRecord,
    getCardHistory,
    getCardHistoryById,
    getCardHistoryCount,
    listCardHistoryInCreatedAtWindow
} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {createdAtWindowForShanghaiDays} from '../utils/heatmap.js';
import {formatShanghaiTimestamp, parseShanghaiDayKey, shanghaiDayKeyFromStored} from '../utils/shanghaiTime.js';
import {readingForSentence} from './practiceDeck.js';

export interface HistoryQuery {
    page?: string;
    pageSize?: string;
    /** 北京时间自然日 YYYY-MM-DD。缺省时保持原来的全部历史。 */
    day?: string;
}

export class HistoryDayError extends Error {
    readonly code = 'INVALID_DAY';

    constructor() {
        super('日期要用北京时间的 YYYY-MM-DD。');
        this.name = 'HistoryDayError';
    }
}

export function normalizePagination (query: HistoryQuery): {page: number; pageSize: number; offset: number;} {
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
    const dayText = query.day?.trim() ?? '';
    if (dayText) {
        const day = parseShanghaiDayKey(dayText);
        if (!day) {
            throw new HistoryDayError();
        }
        const bounds = createdAtWindowForShanghaiDays(day, day);
        const matched = (await listCardHistoryInCreatedAtWindow(db, userId, bounds.start, bounds.end))
            .filter((card) => shanghaiDayKeyFromStored(card.createdAt) === day);
        const total = matched.length;
        return {
            items: matched.slice(offset, offset + pageSize).map(presentHistoryCard),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

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
