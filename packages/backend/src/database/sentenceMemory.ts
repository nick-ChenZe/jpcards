import {createHash, randomUUID} from 'crypto';
import {desc, eq} from 'drizzle-orm';
import {db} from './d1Client.js';
import {sentenceMemory} from './schema.js';

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
    const rows = await db.select({sentence: sentenceMemory.sentence})
        .from(sentenceMemory)
        .where(eq(sentenceMemory.userId, userId))
        .orderBy(desc(sentenceMemory.createdAt))
        .limit(RECENT_LIMIT);

    return rows.map((r) => r.sentence);
}

export async function insertSentence (
    userId: string,
    sentence: string,
    level: string = DEFAULT_LEVEL
): Promise<void> {
    const hash = sentenceHash(sentence);
    const id = randomUUID();
    await db.insert(sentenceMemory)
        .values({
            id,
            userId,
            sentence,
            sentenceHash: hash,
            level
        })
        .onConflictDoNothing();
}
