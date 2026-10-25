import {
    inclusiveShanghaiDayCount,
    parseShanghaiDayKey,
    shanghaiDayKeyFromStored,
    shanghaiDayWindow,
    shiftShanghaiDayKey
} from './shanghaiTime.js';

/** 缺省窗口：含今天在内的 12 个星期，84 个北京时间自然日。 */
export const HEATMAP_DEFAULT_DAYS = 84;

/** 一次请求最多横跨的北京时间自然日（含首尾）。 */
export const HEATMAP_MAX_DAYS = 400;

export interface HeatmapDay {
    day: string;
    count: number;
}

/**
 * 按北京时间自然日数张数。和连签共用 shanghaiDayKeyFromStored。
 * 只返回 count > 0 的日子，空日由前端当 0。不在这里算墨色。
 */
export function countCardsByShanghaiDay (
    createdAtValues: readonly string[],
    fromKey: string,
    toKey: string
): HeatmapDay[] {
    const counts = new Map<string, number>();
    for (const value of createdAtValues) {
        const key = shanghaiDayKeyFromStored(value);
        if (!key || key < fromKey || key > toKey) {
            continue;
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .filter((entry) => entry[1] > 0)
        .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
        .map(([day, count]) => ({day, count}));
}

/**
 * created_at 存的是 UTC 文本。沪日零点落在前一天 16:00 UTC。
 * 日期前缀放宽一天再交给 shanghaiDayKeyFromStored，避免空格和 T/Z 两种写法被字符串比较切错。
 */
export function createdAtWindowForShanghaiDays (fromKey: string, toKey: string): {start: string; end: string;} {
    return {
        start: shiftShanghaiDayKey(fromKey, -1),
        end: shiftShanghaiDayKey(toKey, 2)
    };
}

export function resolveHeatmapRange (
    fromRaw: string | undefined,
    toRaw: string | undefined,
    now: Date = new Date()
): {ok: true; from: string; to: string;} | {ok: false; message: string;} {
    const today = shanghaiDayWindow(now).dayKey;
    const fromText = fromRaw?.trim() ?? '';
    const toText = toRaw?.trim() ?? '';
    const invalid = '开始和结束都要是北京时间的 YYYY-MM-DD。';

    let from: string;
    let to: string;
    if (!fromText && !toText) {
        to = today;
        from = shiftShanghaiDayKey(today, -(HEATMAP_DEFAULT_DAYS - 1));
    } else if (fromText && !toText) {
        const parsed = parseShanghaiDayKey(fromText);
        if (!parsed) {
            return {ok: false, message: invalid};
        }
        from = parsed;
        to = today;
    } else if (!fromText && toText) {
        const parsed = parseShanghaiDayKey(toText);
        if (!parsed) {
            return {ok: false, message: invalid};
        }
        to = parsed;
        from = shiftShanghaiDayKey(to, -(HEATMAP_DEFAULT_DAYS - 1));
    } else {
        const parsedFrom = parseShanghaiDayKey(fromText);
        const parsedTo = parseShanghaiDayKey(toText);
        if (!parsedFrom || !parsedTo) {
            return {ok: false, message: invalid};
        }
        from = parsedFrom;
        to = parsedTo;
    }

    if (from > to) {
        return {ok: false, message: '开始日不能晚于结束日。'};
    }
    if (inclusiveShanghaiDayCount(from, to) > HEATMAP_MAX_DAYS) {
        return {ok: false, message: '一次最多看 400 个北京时间自然日。'};
    }
    return {ok: true, from, to};
}
