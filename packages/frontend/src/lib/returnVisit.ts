export type ExploreSurface = 'empty' | 'drawing' | 'hero';

/** 与 shanghaiTime.shiftShanghaiDayKey 同一算法：YYYY-MM-DD 上移动自然日。 */
function shiftDayKey (dayKey: string, deltaDays: number): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!match) {
        return dayKey;
    }
    const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export interface ReturnVisitSources {
    yesterdayOk: boolean;
    yesterdayBody: unknown;
    todayOk: boolean;
    todayBody: unknown;
    /** 这一屏已经在抽，或今日日签已经展开。 */
    drawnNow: boolean;
}

export function historyDayTotal (body: unknown): number | null {
    if (!body || typeof body !== 'object') {
        return null;
    }
    const record = body as {items?: unknown; pagination?: unknown;};
    const pagination = record.pagination;
    if (pagination && typeof pagination === 'object' && 'total' in pagination) {
        const total = (pagination as {total?: unknown;}).total;
        if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
            return Math.floor(total);
        }
        return null;
    }
    if (Array.isArray(record.items)) {
        return record.items.length;
    }
    return null;
}

/** 历史接口新的在前。取第一句非空日文，不改写原文里的空格。 */
export function newestHistorySentence (body: unknown): string | null {
    if (!body || typeof body !== 'object') {
        return null;
    }
    const items = (body as {items?: unknown;}).items;
    if (!Array.isArray(items)) {
        return null;
    }
    for (const item of items) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const sentence = (item as {sentence?: unknown;}).sentence;
        if (typeof sentence === 'string' && sentence.trim()) {
            return sentence.trim();
        }
    }
    return null;
}

/**
 * 昨天有一句、且今天还没抽，才返回那句日文。
 * 没有昨天、今天已经有卡、或任一侧读失败，都返回 null（首屏零节点）。
 */
export function returnVisitSentence (input: ReturnVisitSources): string | null {
    if (input.drawnNow || !input.yesterdayOk || !input.todayOk) {
        return null;
    }
    const todayCount = historyDayTotal(input.todayBody);
    if (todayCount === null || todayCount > 0) {
        return null;
    }
    return newestHistorySentence(input.yesterdayBody);
}

/** 对照只挂在未抽首屏。抽签中和已展开的日签都不留这块。 */
export function visibleReturnVisit (sentence: string | null, surface: ExploreSurface): string | null {
    if (surface !== 'empty') {
        return null;
    }
    const trimmed = sentence?.trim() ?? '';
    return trimmed ? trimmed : null;
}

async function readJson (response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function loadReturnVisitSentence (
    todayKey: string,
    options: {signal?: AbortSignal; fetchImpl?: typeof fetch;} = {}
): Promise<string | null> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const yesterday = shiftDayKey(todayKey, -1);
    const init = {credentials: 'include' as const, signal: options.signal};
    try {
        const [yesterdayResponse, todayResponse] = await Promise.all([
            fetchImpl(`/api/history?day=${yesterday}&page=1&pageSize=1`, init),
            fetchImpl(`/api/history?day=${todayKey}&page=1&pageSize=1`, init)
        ]);
        return returnVisitSentence({
            yesterdayOk: yesterdayResponse.ok,
            yesterdayBody: yesterdayResponse.ok ? await readJson(yesterdayResponse) : null,
            todayOk: todayResponse.ok,
            todayBody: todayResponse.ok ? await readJson(todayResponse) : null,
            drawnNow: false
        });
    } catch {
        return null;
    }
}
