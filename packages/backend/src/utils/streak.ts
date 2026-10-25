import {shanghaiDayKeyFromStored, shanghaiDayWindow, shiftShanghaiDayKey} from './shanghaiTime.js';

/**
 * 连签天数：北京时间自然日里，至少抽出一张卡的连续天数。
 * 今天还没抽、昨天抽过，算连着，不在当天结束前清零。
 * 同一天多张只算一天。不新增表，只读已有卡片时间。
 */
export function countStreakDays (createdAtValues: readonly string[], now: Date = new Date()): number {
    const days = new Set<string>();
    for (const value of createdAtValues) {
        const key = shanghaiDayKeyFromStored(value);
        if (key) {
            days.add(key);
        }
    }

    const today = shanghaiDayWindow(now).dayKey;
    const start = days.has(today) ? today : shiftShanghaiDayKey(today, -1);
    if (!days.has(start)) {
        return 0;
    }

    let count = 0;
    let cursor = start;
    while (days.has(cursor)) {
        count += 1;
        cursor = shiftShanghaiDayKey(cursor, -1);
    }
    return count;
}
