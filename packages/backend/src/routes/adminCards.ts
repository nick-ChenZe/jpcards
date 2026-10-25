import type {AdminCardRecord} from '../database/cardHistory.js';
import {countAllCards, listAllCards} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {type HistoryQuery, normalizePagination, presentHistoryCard} from './history.js';

/** 成功读取全量卡片时记一条。只含管理员、时间和条数，不写卡片内容。 */
export function logAdminCardList (adminId: string, resultCount: number): void {
    console.log(JSON.stringify({
        audit: 'admin.cards.list',
        adminId,
        timestamp: new Date().toISOString(),
        resultCount
    }));
}

export function presentAdminCard (card: AdminCardRecord) {
    const {userEmail, userName, username, ...rest} = card;
    return {
        ...presentHistoryCard(rest),
        user: {
            id: card.userId,
            email: userEmail,
            name: userName,
            username
        }
    };
}

export async function getAdminCardsResponse (db: AppDatabase, query: HistoryQuery) {
    const {page, pageSize, offset} = normalizePagination(query);
    const [items, total] = await Promise.all([
        listAllCards(db, pageSize, offset),
        countAllCards(db)
    ]);

    return {
        items: items.map(presentAdminCard),
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}
