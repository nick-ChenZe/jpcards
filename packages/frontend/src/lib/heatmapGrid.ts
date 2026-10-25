import {shanghaiDayWindow, shiftShanghaiDayKey} from '../../../backend/src/utils/shanghaiTime';
import {type HeatInkLevel, heatInkLevel} from './heatInk';

/** 日签墙旁边的格子：12 周，周日开始，和顶栏曜日一致。 */
export const FOOTPRINT_WEEKS = 12;

export interface FootprintCell {
    day: string;
    count: number;
    level: HeatInkLevel;
    future: boolean;
    today: boolean;
    month: number;
    dayOfMonth: number;
}

export interface FootprintWeek {
    id: string;
    monthLabel: string;
    cells: FootprintCell[];
}

function weekdayIndex (dayKey: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!match) {
        return 0;
    }
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

/** 含本周尚未到来的日子。请求发给 heatmap 时，空日不会出现在响应里。 */
export function footprintWindow (now: Date = new Date()): {from: string; to: string; today: string;} {
    const today = shanghaiDayWindow(now).dayKey;
    const weekStart = shiftShanghaiDayKey(today, -weekdayIndex(today));
    return {
        today,
        from: shiftShanghaiDayKey(weekStart, -7 * (FOOTPRINT_WEEKS - 1)),
        to: shiftShanghaiDayKey(weekStart, 6)
    };
}

export function buildFootprintWeeks (
    from: string,
    to: string,
    today: string,
    counts: ReadonlyMap<string, number>
): FootprintWeek[] {
    const weeks: FootprintWeek[] = [];
    let cursor = from;
    let previousMonth = 0;
    while (cursor <= to) {
        const cells: FootprintCell[] = [];
        let monthLabel = '';
        for (let index = 0; index < 7 && cursor <= to; index += 1) {
            const stored = counts.get(cursor) ?? 0;
            const count = stored > 0 ? stored : 0;
            const parts = cursor.split('-');
            const month = Number(parts[1]);
            const dayOfMonth = Number(parts[2]);
            if (month !== previousMonth) {
                monthLabel = `${month}月`;
                previousMonth = month;
            }
            cells.push({
                day: cursor,
                count,
                level: heatInkLevel(count),
                future: cursor > today,
                today: cursor === today,
                month,
                dayOfMonth
            });
            cursor = shiftShanghaiDayKey(cursor, 1);
        }
        const first = cells[0];
        if (first) {
            weeks.push({id: first.day, monthLabel, cells});
        }
    }
    return weeks;
}

function monthDate (month: string): Date {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Invalid calendar month');
    return new Date(`${month}-01T00:00:00.000Z`);
}

export function shiftFootprintMonth (month: string, delta: number): string {
    const date = monthDate(month);
    date.setUTCMonth(date.getUTCMonth() + delta);
    return date.toISOString().slice(0, 7);
}

/** A full month on a Sunday-first calendar; null cells are padding, never invented days. */
export function buildFootprintMonth (month: string, today: string, counts: ReadonlyMap<string, number>) {
    const first = monthDate(month);
    const last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    const from = `${month}-01`;
    const to = last.toISOString().slice(0, 10);
    const cells: (FootprintCell | null)[] = Array.from({length: first.getUTCDay()}, () => null);
    for (let day = 1; day <= last.getUTCDate(); day += 1) {
        const key = `${month}-${String(day).padStart(2, '0')}`;
        const stored = counts.get(key) ?? 0;
        const future = key > today;
        const count = !future && Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
        cells.push({
            day: key,
            count,
            level: heatInkLevel(count),
            future,
            today: key === today,
            month: first.getUTCMonth() + 1,
            dayOfMonth: day
        });
    }
    while (cells.length % 7) cells.push(null);
    return {from, to, year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, cells};
}
