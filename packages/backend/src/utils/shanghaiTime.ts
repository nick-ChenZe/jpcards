/**
 * 把库里的时间显示成北京时间。
 * SQLite `CURRENT_TIMESTAMP` 是 UTC，而且没有时区后缀。
 * 上海没有夏令时，固定按 UTC+8 计算，避免浏览器把它当成当地时间。
 */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function formatShanghaiTimestamp (value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const date = instantFromStoredTimestamp(trimmed);
    if (!date) {
        return trimmed;
    }
    const shanghai = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
    const year = shanghai.getUTCFullYear();
    const month = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shanghai.getUTCDate()).padStart(2, '0');
    const hour = String(shanghai.getUTCHours()).padStart(2, '0');
    const minute = String(shanghai.getUTCMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}`;
}

export interface ShanghaiDayWindow {
    /** 北京时间日期，YYYY-MM-DD。 */
    dayKey: string;
    /** 下一个北京时间零点，用 UTC 时刻表示。 */
    resetsAt: string;
}

/** 库里的 UTC 时间戳解析成时刻。解析失败返回 null。 */
export function instantFromStoredTimestamp (value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
    const iso = hasZone ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

/** 北京时间自然日。上海没有夏令时，固定按 UTC+8 切日。 */
export function shanghaiDayWindow (now: Date = new Date()): ShanghaiDayWindow {
    const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const day = shifted.getUTCDate();
    const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const resetsAtMs = Date.UTC(year, month, day + 1) - SHANGHAI_OFFSET_MS;
    return {
        dayKey,
        resetsAt: new Date(resetsAtMs).toISOString()
    };
}

/** 存储时间对应的北京时间日期。无法解析时返回 null。 */
export function shanghaiDayKeyFromStored (value: string): string | null {
    const instant = instantFromStoredTimestamp(value);
    if (!instant) {
        return null;
    }
    return shanghaiDayWindow(instant).dayKey;
}

const SHANGHAI_DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 合法的北京时间日期。非法月日返回 null。 */
export function parseShanghaiDayKey (value: string): string | null {
    const match = SHANGHAI_DAY_KEY.exec(value.trim());
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
}

/** 含首尾的自然日数。from、to 须已是合法北京时间日期。 */
export function inclusiveShanghaiDayCount (fromKey: string, toKey: string): number {
    const from = parseShanghaiDayKey(fromKey);
    const to = parseShanghaiDayKey(toKey);
    if (!from || !to) {
        return 0;
    }
    const fromMatch = SHANGHAI_DAY_KEY.exec(from);
    const toMatch = SHANGHAI_DAY_KEY.exec(to);
    if (!fromMatch || !toMatch) {
        return 0;
    }
    const start = Date.UTC(Number(fromMatch[1]), Number(fromMatch[2]) - 1, Number(fromMatch[3]));
    const end = Date.UTC(Number(toMatch[1]), Number(toMatch[2]) - 1, Number(toMatch[3]));
    return Math.round((end - start) / 86_400_000) + 1;
}

export interface WallDate {
    key: string;
    month: number;
    day: number;
    /** 墙上读得出来的日期，例如「10月25日」。当天也不写成「今天」。 */
    breath: string;
}

/**
 * 日签墙按北京时间自然日取日期。
 * 每张卡片、每个日分组都写「M月D日」，不用「今天」把整天墙标成同一天。
 */
export function wallDateFromStored (value: string): WallDate {
    const key = shanghaiDayKeyFromStored(value);
    if (!key) {
        return {key: value || 'unknown', month: 0, day: 0, breath: value};
    }
    const [, monthText, dayText] = key.split('-');
    const month = Number(monthText);
    const day = Number(dayText);
    return {
        key,
        month,
        day,
        breath: `${month}月${day}日`
    };
}

/** 在 YYYY-MM-DD 上移动自然日。不处理时区，调用方应已是北京时间日期。 */
export function shiftShanghaiDayKey (dayKey: string, deltaDays: number): string {
    const match = SHANGHAI_DAY_KEY.exec(dayKey);
    if (!match) {
        return dayKey;
    }
    const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
