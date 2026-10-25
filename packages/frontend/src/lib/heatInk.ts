/**
 * 唯一墨阶（张聪 2026-10-25）。API 只给 {day, count}，浓淡在这里算。
 * 0 纸洗；1、2 各一档；3 与 4 同档；5 张起最浓。
 */
export const HEAT_INK = {
    1: '#E8E0D4',
    2: '#C4B8A8',
    3: '#8A7E72',
    4: '#2C2420'
} as const;

export type HeatInkLevel = 0 | 1 | 2 | 3 | 4;

export function heatInkLevel (count: number): HeatInkLevel {
    if (!Number.isFinite(count) || count <= 0) {
        return 0;
    }
    const drawn = Math.floor(count);
    if (drawn === 1) {
        return 1;
    }
    if (drawn === 2) {
        return 2;
    }
    if (drawn <= 4) {
        return 3;
    }
    return 4;
}

/** 0 返回 null，表示纸洗，不填墨色。 */
export function heatInkColor (count: number): string | null {
    const level = heatInkLevel(count);
    if (level === 0) {
        return null;
    }
    return HEAT_INK[level];
}
