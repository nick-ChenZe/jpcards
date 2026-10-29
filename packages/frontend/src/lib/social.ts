export interface SocialUser {
    id: string;
    name: string;
    handle: string;
}
export interface SocialFriend extends SocialUser {
    since: number;
    muted: boolean;
    conversationId: string;
}
export interface SocialPreferences {
    letters: boolean;
    requests: boolean;
    system: boolean;
    discoverable: boolean;
}
export interface SocialOverview {
    me: SocialUser;
    friends: SocialFriend[];
    incoming: {id: string; sender: SocialUser; createdAt: number;}[];
    outgoing: {id: string; recipient: SocialUser; createdAt: number;}[];
    blocked: SocialUser[];
    summary: {letters: number; requests: number; notices: number; total: number; latestLetterSeq: number;};
    preferences: SocialPreferences;
}
export interface SharedCard {
    id: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    reading?: string;
    readingTokens?: unknown;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string | number;
}
export interface SocialMessage {
    id: string;
    seq: number;
    senderId: string;
    clientMessageId: string;
    type: 'text' | 'card';
    text?: string;
    shareId?: string;
    card?: Pick<SharedCard, 'sentence' | 'gloss' | 'level'> | null;
    createdAt: number;
    revoked?: boolean;
    cardVerification?: 'checking' | 'unavailable';
}
export interface SocialThread {
    id: string;
    peer: SocialUser;
    canSend: boolean;
    muted: boolean;
    items: SocialMessage[];
    hasMore: boolean;
    nextBefore: number | null;
    nextAfter?: number;
    lastReadSeq: number;
}
export interface ConversationSummary {
    id: string;
    peer: SocialUser;
    lastMessage: SocialMessage | null;
    lastAt: number;
    unread: number;
    canSend: boolean;
    muted: boolean;
}
export interface SocialNotice {
    id: string;
    title: string;
    body: string;
    createdAt: number;
    read: boolean;
}
export interface PageResult<T> {
    items: T[];
    hasMore: boolean;
    page: number;
    maxId?: number;
}
export interface IncomingLetters {
    items: {seq: number; conversationId: string; peer: SocialUser; muted: boolean;}[];
    hasMore: boolean;
    nextAfter: number;
}

/** Active threads render their own in-thread indication; muted conversations never banner. */
export function incomingBanner (
    items: IncomingLetters['items'],
    activeConversationId?: string
): IncomingLetters['items'][number] | undefined {
    return items.filter(item => !item.muted && item.conversationId !== activeConversationId).at(-1);
}

/** A bulk-read action uses the server's snapshot identifier, never a timestamp. */
export function noticeReadCutoff (maxId: unknown): number {
    return typeof maxId === 'number' && Number.isSafeInteger(maxId) && maxId > 0 ? maxId : 0;
}
export interface OutgoingLetter {
    clientMessageId: string;
    type: 'text' | 'card';
    text?: string;
    cardId?: string;
    card?: Pick<SharedCard, 'sentence' | 'gloss' | 'level'>;
    status: 'sending' | 'failed';
    error?: string;
}
export const OUTBOX_LIMIT = 50;

/** A full queue is left intact; the caller keeps the draft instead of discarding an earlier letter. */
export function appendOutbox (outbox: OutgoingLetter[], letter: OutgoingLetter): OutgoingLetter[] | null {
    return outbox.length >= OUTBOX_LIMIT ? null : [...outbox, letter];
}

export async function socialApi<T> (path = '', init: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/social${path}`, {
        ...init,
        credentials: 'include',
        headers: {'Content-Type': 'application/json', ...init.headers}
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const message = body?.message;
        throw new Error(
            typeof message === 'string' && /[\u4e00-\u9fff]/.test(message)
                ? message
                : response.status === 401
                ? '登录已过期，请重新登录。'
                : '这次没有连上，请稍后重试。'
        );
    }
    return body as T;
}

export const socialWrite = <T>(path: string, body?: unknown, method = 'POST') =>
    socialApi<T>(path, {
        method,
        ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });

export function socialDate (value: number): string {
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(value);
}

export function mergeLetters (current: SocialMessage[], incoming: SocialMessage[]): SocialMessage[] {
    const byId = new Map(current.map(item => [item.id, item]));
    for (const item of incoming) byId.set(item.id, item);
    return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

export type ShareVerification =
    | {id: string; state: 'available'; card: Pick<SharedCard, 'sentence' | 'gloss' | 'level'>;}
    | {id: string; state: 'revoked' | 'unavailable';};

/** Hide previous plaintext while checking, including after a network or authorization failure. */
export function concealSharedPreviews (items: SocialMessage[], state: 'checking' | 'unavailable'): SocialMessage[] {
    return items.map(item => item.type === 'card' && !item.revoked
        ? {...item, card: null, cardVerification: state}
        : item);
}

export function applyShareVerifications (items: SocialMessage[], checks: ShareVerification[]): SocialMessage[] {
    const byId = new Map(checks.map(check => [check.id, check]));
    return items.map(item => {
        const check = item.type === 'card' ? byId.get(item.shareId || item.id) : undefined;
        if (!check) return item;
        if (check.state === 'available') return {...item, card: check.card, revoked: false, cardVerification: undefined};
        if (check.state === 'revoked') return {...item, card: null, revoked: true, cardVerification: undefined};
        return {...item, card: null, revoked: false, cardVerification: 'unavailable'};
    });
}

export function readLocal<T> (key: string, fallback: T): T {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null') as T || fallback;
    } catch {
        return fallback;
    }
}

export function writeLocal (key: string, value: unknown): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function restoreOutbox (value: unknown): OutgoingLetter[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is OutgoingLetter =>
        Boolean(
            item && typeof item.clientMessageId === 'string'
                && (item.type === 'text' && typeof item.text === 'string'
                    || item.type === 'card' && typeof item.cardId === 'string')
        )
    ).map(item => ({...item, status: 'failed', error: '上次未确认送达，可以重试同一封信。'}));
}

/** Reuse the pending key across dialog close, navigation, reload and uncertain responses. */
export function prepareSharedLetter (
    value: unknown,
    cardId: string,
    newId: () => string
): {letter: OutgoingLetter; outbox: OutgoingLetter[];} {
    const outbox = restoreOutbox(value);
    const existing = outbox.find(item => item.type === 'card' && item.cardId === cardId);
    if (existing) return {letter: existing, outbox};
    const letter: OutgoingLetter = {clientMessageId: newId(), type: 'card', cardId, status: 'sending'};
    const next = appendOutbox(outbox, letter);
    if (!next) throw new Error('待寄书信有些多，请先处理之前的书信。');
    return {letter, outbox: next};
}

/** Message keys are scoped by sender; a peer using the same key cannot acknowledge our outbox. */
export function reconcileOutbox (
    outbox: OutgoingLetter[],
    messages: SocialMessage[],
    userId: string
): OutgoingLetter[] {
    const delivered = new Set(messages.filter(item => item.senderId === userId).map(item => item.clientMessageId));
    return outbox.filter(item => !delivered.has(item.clientMessageId));
}
