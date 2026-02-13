import {randomUUID} from 'crypto';
import {getPool} from './index.js';

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
    const pool = getPool();
    await pool.query(
        `INSERT INTO card_history (id, user_id, sentence, sentence_html, audio_url, illustration_url, level)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.userId,
            input.sentence,
            input.sentenceHtml,
            input.audioUrl ?? null,
            input.illustrationUrl ?? null,
            input.level ?? 'N5'
        ]
    );
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
    const pool = getPool();
    await pool.query(
        `UPDATE card_history SET audio_url = ?, illustration_url = ? WHERE id = ?`,
        [audioUrl, illustrationUrl, cardId]
    );
}

/**
 * 获取用户的卡片浏览历史（分页）
 */
export async function getCardHistory (
    userId: string,
    limit: number = 20,
    offset: number = 0
): Promise<CardHistoryRecord[]> {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT id, user_id, sentence, sentence_html, audio_url, illustration_url, level, created_at
         FROM card_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );
    const list = (Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>;
    return list.map((row) => ({
        id: row.id as string,
        userId: row.user_id as string,
        sentence: row.sentence as string,
        sentenceHtml: row.sentence_html as string,
        audioUrl: (row.audio_url as string) || null,
        illustrationUrl: (row.illustration_url as string) || null,
        level: row.level as string,
        createdAt: String(row.created_at)
    }));
}

/**
 * 获取用户的卡片总数
 */
export async function getCardHistoryCount (userId: string): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM card_history WHERE user_id = ?`,
        [userId]
    );
    const list = (Array.isArray(rows) ? rows : []) as Array<{total: number}>;
    return list[0]?.total ?? 0;
}
