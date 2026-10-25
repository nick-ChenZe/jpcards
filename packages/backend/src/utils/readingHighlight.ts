export interface ReadingToken {
    surface: string;
    reading?: string;
    moraWeight: number;
}

/** 拗音用的小写假名，贴在前一个假名上，不单独占拍。促音っ/ッ要占拍。 */
const SMALL_YOUON = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';

function isSmallYouon (char: string): boolean {
    return SMALL_YOUON.includes(char);
}

function isKana (char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x3041 && code <= 0x3096) {
        return true;
    }
    if (code >= 0x30a1 && code <= 0x30fa) {
        return true;
    }
    return code === 0x30fc || code === 0xff70;
}

function isContentChar (char: string): boolean {
    if (isKana(char)) {
        return true;
    }
    if (/[\u4e00-\u9fff]/.test(char)) {
        return true;
    }
    return /[A-Za-z0-9]/.test(char);
}

export function isPunctuationOnly (text: string): boolean {
    if (!text) {
        return true;
    }
    for (const char of text) {
        if (isContentChar(char)) {
            return false;
        }
    }
    return true;
}

/** 假名各算一拍，长音符号ー也算一拍。拗音小字和标点不算。 */
export function moraWeightOf (text: string): number {
    let weight = 0;
    for (const char of text) {
        if (isSmallYouon(char)) {
            continue;
        }
        if (isKana(char)) {
            weight += 1;
        }
    }
    return weight;
}

export function parseReadingTokens (value: unknown): ReadingToken[] | null {
    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }
    const tokens: ReadingToken[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const row = item as Record<string, unknown>;
        if (typeof row.surface !== 'string' || row.surface.length === 0) {
            return null;
        }
        if (typeof row.moraWeight !== 'number' || !Number.isFinite(row.moraWeight) || row.moraWeight < 0) {
            return null;
        }
        const token: ReadingToken = {surface: row.surface, moraWeight: row.moraWeight};
        if (row.reading !== undefined) {
            if (typeof row.reading !== 'string') {
                return null;
            }
            token.reading = row.reading;
        }
        tokens.push(token);
    }
    return tokens;
}

export function parseStoredReadingTokens (raw: unknown): ReadingToken[] | null {
    if (raw == null || raw === '') {
        return null;
    }
    try {
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parseReadingTokens(value);
    } catch {
        return null;
    }
}

export function serializeReadingTokens (tokens: ReadingToken[] | null | undefined): string | null {
    if (!tokens || tokens.length === 0) {
        return null;
    }
    return JSON.stringify(tokens.map((token) => {
        const stored: ReadingToken = {surface: token.surface, moraWeight: token.moraWeight};
        if (token.reading !== undefined) {
            stored.reading = token.reading;
        }
        return stored;
    }));
}

/**
 * 按时长把整段音频线性分给 moraWeight。权重为 0 的词不占时间。
 * 时长未知、不是有限正数、或总权重为 0 时返回 null，调用方不高亮。
 */
export function activeTokenIndex (
    tokens: Array<{moraWeight: number;}>,
    currentTime: number,
    duration: number
): number | null {
    if (tokens.length === 0) {
        return null;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
        return null;
    }
    if (!Number.isFinite(currentTime) || currentTime < 0) {
        return null;
    }
    const weights = tokens.map((token) =>
        token.moraWeight > 0 && Number.isFinite(token.moraWeight) ? token.moraWeight : 0
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) {
        return null;
    }
    let lastPositive = -1;
    for (let index = weights.length - 1; index >= 0; index -= 1) {
        if (weights[index] > 0) {
            lastPositive = index;
            break;
        }
    }
    const time = Math.min(currentTime, duration);
    let cursor = 0;
    for (let index = 0; index < weights.length; index += 1) {
        const span = (weights[index] / total) * duration;
        const end = cursor + span;
        if (weights[index] > 0) {
            const hit = time >= cursor && (time < end || (index === lastPositive && time <= duration));
            if (hit) {
                return index;
            }
        }
        cursor = end;
    }
    return lastPositive >= 0 ? lastPositive : null;
}

/** 还没开始播放、已经播完、或没有时长时不高亮。暂停在中途则留在当前词。 */
export function playbackTokenIndex (
    tokens: ReadingToken[] | null,
    currentTime: number,
    duration: number,
    playing: boolean,
    ended: boolean
): number | null {
    if (!tokens || ended) {
        return null;
    }
    if (!playing && currentTime <= 0) {
        return null;
    }
    return activeTokenIndex(tokens, currentTime, duration);
}

export function readingLineParts (
    reading: string,
    tokens: ReadingToken[]
): {parts: string[]; suffix: string;} | null {
    if (!reading || tokens.length === 0) {
        return null;
    }
    const full = reading.indexOf('（');
    const ascii = reading.indexOf('(');
    const splitAt = full === -1 ? ascii : ascii === -1 ? full : Math.min(full, ascii);
    const kana = splitAt === -1 ? reading : reading.slice(0, splitAt);
    const suffix = splitAt === -1 ? '' : reading.slice(splitAt);
    const parts = tokens.map((token) => token.reading ?? token.surface);
    if (parts.join('') !== kana) {
        return null;
    }
    return {parts, suffix};
}

function decodeEntity (body: string): string {
    if (body === 'amp') {
        return '&';
    }
    if (body === 'lt') {
        return '<';
    }
    if (body === 'gt') {
        return '>';
    }
    if (body === 'quot') {
        return '"';
    }
    if (body === '#039' || body === 'apos') {
        return '\'';
    }
    if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = Number.parseInt(body.slice(2), 16);
        return Number.isFinite(code) && code >= 0 ? String.fromCodePoint(code) : '';
    }
    if (body.startsWith('#')) {
        const code = Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code >= 0 ? String.fromCodePoint(code) : '';
    }
    return '';
}

function readChar (html: string, index: number): {text: string; raw: string; next: number;} | null {
    if (html.startsWith('&', index)) {
        const match = /^&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/.exec(html.slice(index));
        if (!match) {
            return {text: '&', raw: '&', next: index + 1};
        }
        return {text: decodeEntity(match[1]), raw: match[0], next: index + match[0].length};
    }
    const code = html.codePointAt(index);
    if (code === undefined) {
        return null;
    }
    const text = String.fromCodePoint(code);
    return {text, raw: text, next: index + text.length};
}

function rubyVisible (block: string): string {
    const withoutRt = block.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '');
    const text = withoutRt.replace(/<[^>]+>/g, '');
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, '\'');
}

function htmlAtoms (html: string): Array<{html: string; text: string;}> | null {
    const atoms: Array<{html: string; text: string;}> = [];
    let index = 0;
    while (index < html.length) {
        if (html.startsWith('<ruby>', index)) {
            const end = html.indexOf('</ruby>', index);
            if (end < 0) {
                return null;
            }
            const raw = html.slice(index, end + '</ruby>'.length);
            atoms.push({html: raw, text: rubyVisible(raw)});
            index = end + '</ruby>'.length;
            continue;
        }
        if (html[index] === '<') {
            return null;
        }
        const char = readChar(html, index);
        if (!char || char.next <= index) {
            return null;
        }
        atoms.push({html: char.raw, text: char.text});
        index = char.next;
    }
    return atoms;
}

/** 按词切开展示用的 sentenceHtml，保住汉字上的 ruby。对不齐时返回 null，调用方整句不高亮。 */
export function splitSentenceHtml (html: string, surfaces: string[]): string[] | null {
    if (surfaces.length === 0) {
        return null;
    }
    const atoms = htmlAtoms(html);
    if (!atoms) {
        return null;
    }
    const parts: string[] = [];
    let cursor = 0;
    for (const surface of surfaces) {
        if (!surface) {
            return null;
        }
        let left = surface;
        let chunk = '';
        while (left.length > 0) {
            if (cursor >= atoms.length) {
                return null;
            }
            const atom = atoms[cursor];
            cursor += 1;
            if (atom.text.length === 0) {
                chunk += atom.html;
                continue;
            }
            if (!left.startsWith(atom.text)) {
                return null;
            }
            chunk += atom.html;
            left = left.slice(atom.text.length);
        }
        parts.push(chunk);
    }
    if (cursor !== atoms.length) {
        return null;
    }
    return parts;
}
