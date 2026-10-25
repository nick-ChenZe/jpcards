import {shanghaiDayKeyFromStored, shanghaiDayWindow} from '../../../backend/src/utils/shanghaiTime';

const WEEKDAYS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

/** 探索页顶栏：北京时间的曜日和「M月D日」。 */
export function shanghaiRitualDate (now: Date = new Date()): {weekday: string; fullDate: string; dayKey: string;} {
    const dayKey = shanghaiDayWindow(now).dayKey;
    const [, monthText, dayText] = dayKey.split('-');
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return {
        weekday: WEEKDAYS[shifted.getUTCDay()] ?? '',
        fullDate: `${Number(monthText)}月${Number(dayText)}日`,
        dayKey
    };
}

export interface WallDate {
    key: string;
    month: number;
    day: number;
    breath: string;
}

/** 日签墙按北京时间自然日分组。今天写成「今天」，其余是「M月D日」。 */
export function wallDateFromStored (value: string, todayKey: string): WallDate {
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
        breath: key === todayKey ? '今天' : `${month}月${day}日`
    };
}

/**
 * 把库里的 UTC 时间显示成北京时间。与后端 shanghaiTime 保持同一算法。
 * SQLite CURRENT_TIMESTAMP 没有时区，按 UTC 解析后再加 8 小时。
 */
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
    const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const year = shanghai.getUTCFullYear();
    const month = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shanghai.getUTCDate()).padStart(2, '0');
    const hour = String(shanghai.getUTCHours()).padStart(2, '0');
    const minute = String(shanghai.getUTCMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}`;
}
