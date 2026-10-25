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
    const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
    const iso = hasZone ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
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
