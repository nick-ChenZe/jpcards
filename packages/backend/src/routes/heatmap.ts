import {listCardCreatedAtInWindow} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {
    countCardsByShanghaiDay,
    createdAtWindowForShanghaiDays,
    type HeatmapDay,
    resolveHeatmapRange
} from '../utils/heatmap.js';

export interface HeatmapQuery {
    from?: string;
    to?: string;
}

export async function getHeatmapResponse (
    db: AppDatabase,
    userId: string,
    query: HeatmapQuery,
    now: Date = new Date()
): Promise<{ok: true; days: HeatmapDay[];} | {ok: false; message: string;}> {
    const range = resolveHeatmapRange(query.from, query.to, now);
    if (!range.ok) {
        return range;
    }
    const bounds = createdAtWindowForShanghaiDays(range.from, range.to);
    const createdAt = await listCardCreatedAtInWindow(db, userId, bounds.start, bounds.end);
    return {
        ok: true,
        days: countCardsByShanghaiDay(createdAt, range.from, range.to)
    };
}
