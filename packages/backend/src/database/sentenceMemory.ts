import {createHash, randomUUID} from 'crypto';
import {getPool} from './index.js';

const RECENT_LIMIT = 80;
const DEFAULT_LEVEL = 'N5';

function normalizeForHash (s: string): string {
    return s
        .replace(/[\s　]+/g, ' ')
        .replace(/[。．、，,.]/g, '')
        .trim();
}

export function sentenceHash (sentence: string): string {
    return createHash('sha256').update(normalizeForHash(sentence), 'utf8').digest('hex');
}

export async function getRecentSentences (userId: string): Promise<string[]> {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT sentence FROM sentence_memory
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, RECENT_LIMIT]
    );
    const list = (Array.isArray(rows) ? rows : []) as Array<{sentence: string}>;
    return list.map((r) => r.sentence);
}

export async function insertSentence (
    userId: string,
    sentence: string,
    level: string = DEFAULT_LEVEL
): Promise<void> {
    const hash = sentenceHash(sentence);
    const id = randomUUID();
    const pool = getPool();
    await pool.query(
        `INSERT IGNORE INTO sentence_memory (id, user_id, sentence, sentence_hash, level)
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, sentence, hash, level]
    );
}
