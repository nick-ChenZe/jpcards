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
