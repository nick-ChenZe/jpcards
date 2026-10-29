import type {AnyD1Database} from 'drizzle-orm/d1';

type Row = Record<string, unknown>;
type Param = string | number | null;
export type SocialUser = {id: string; name: string; handle: string;};
export interface SocialMessage {
    id: string;
    seq: number;
    clientMessageId: string;
    senderId: string;
    type: 'text' | 'card';
    text?: string;
    shareId?: string;
    revoked?: boolean;
    card?: {sentence: string; gloss: string; level: string;} | null;
    createdAt: number;
}
export class SocialError extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
    }
}

const identityColumns = `u.id, u.name, COALESCE(NULLIF(u.username, ''), p.handle) AS handle`;
const noBlocks = `(NOT EXISTS (SELECT 1 FROM social_block b WHERE
    (b.blocker_id = r.user_low AND b.blocked_id = r.user_high)
    OR (b.blocker_id = r.user_high AND b.blocked_id = r.user_low)))`;
const now = () => Date.now();
const text = (value: unknown) => typeof value === 'string' ? value : '';
const numeric = (value: unknown) => Number(value || 0);
const userView = (row: Row): SocialUser => ({id: text(row.id), name: text(row.name), handle: text(row.handle)});
const pair = (a: string, b: string) => a < b ? [a, b] : [b, a];
const absent = () => new SocialError(404, 'NOT_FOUND', '找不到这份内容。');
const forbidden = () => new SocialError(403, 'RELATIONSHIP_REQUIRED', '现在不能寄信，请先确认好友关系。');
async function conversationId (low: string, high: string) {
    const bytes = new TextEncoder().encode(JSON.stringify([low, high]));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return `cv-${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function positiveInteger (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 && number <= max ? number : fallback;
}

export class SocialService {
    constructor(private db: AnyD1Database, readonly userId: string) {}

    private statement(sql: string, params: Param[] = []) {
        return this.db.prepare(sql).bind(...params);
    }

    private async rows(sql: string, params: Param[] = []): Promise<Row[]> {
        const result = await this.statement(sql, params).all();
        return (result.results || []) as Row[];
    }

    private async first(sql: string, params: Param[] = []): Promise<Row | null> {
        return (await this.rows(sql, params))[0] || null;
    }

    private async run(sql: string, params: Param[] = []): Promise<number> {
        const result = await this.statement(sql, params).run();
        if (!result.success) throw new Error('SOCIAL_WRITE_FAILED');
        return Number(result.meta?.changes || 0);
    }

    private async ensureProfile() {
        await this.run(
            `INSERT INTO social_profile(user_id, handle) VALUES (?, ?)
            ON CONFLICT(user_id) DO NOTHING`,
            [this.userId, `RZ-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`]
        );
    }

    private async user(id: string): Promise<SocialUser> {
        const row = await this.first(
            `SELECT ${identityColumns} FROM user u
            LEFT JOIN social_profile p ON p.user_id = u.id WHERE u.id = ?`,
            [id]
        );
        if (!row) throw absent();
        return userView(row);
    }

    private async blocked(id: string): Promise<boolean> {
        return Boolean(
            await this.first(
                `SELECT 1 FROM social_block WHERE
            (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
                [this.userId, id, id, this.userId]
            )
        );
    }

    private async relation(id: string): Promise<Row | null> {
        const [low, high] = pair(this.userId, id);
        return this.first(
            `SELECT r.*, ${noBlocks} AS unblocked FROM social_relationship r
            WHERE r.user_low = ? AND r.user_high = ?`,
            [low, high]
        );
    }

    private async conversation(id: string): Promise<Row> {
        const row = await this.first(
            `SELECT r.*, m.last_read_seq, m.muted, ${noBlocks} AS unblocked
            FROM social_relationship r JOIN social_member m ON m.conversation_id = r.id
            WHERE r.id = ? AND m.user_id = ? AND ? IN (r.user_low, r.user_high)`,
            [id, this.userId, this.userId]
        );
        if (!row) throw absent();
        return row;
    }

    private peerId(relation: Row) {
        return relation.user_low === this.userId ? text(relation.user_high) : text(relation.user_low);
    }

    async rate(scope: 'search' | 'request' | 'send' | 'report') {
        const [limit, duration] =
            {search: [30, 60000], request: [20, 3600000], send: [60, 60000], report: [10, 3600000]}[scope];
        const at = now();
        const changed = await this.run(
            `INSERT INTO social_rate_limit(user_id, scope, window_start, count)
            VALUES (?, ?, ?, 1) ON CONFLICT(user_id, scope) DO UPDATE SET
            window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END,
            count = CASE WHEN ? - window_start >= ? THEN 1 ELSE count + 1 END
            WHERE ? - window_start >= ? OR count < ?`,
            [this.userId, scope, at, at, duration, at, at, duration, at, duration, limit]
        );
        if (!changed) throw new SocialError(429, 'SOCIAL_RATE_LIMITED', '这会儿来往有些频繁，稍后再试吧。');
    }

    async overview() {
        await this.ensureProfile();
        const me = await this.user(this.userId);
        const friendRows = await this.rows(
            `SELECT ${identityColumns}, r.since, r.id AS conversation_id, m.muted
            FROM social_relationship r JOIN user u ON u.id = CASE WHEN r.user_low = ? THEN r.user_high ELSE r.user_low END
            LEFT JOIN social_profile p ON p.user_id = u.id
            JOIN social_member m ON m.conversation_id = r.id AND m.user_id = ?
            WHERE ? IN (r.user_low, r.user_high) AND r.status = 'accepted' AND ${noBlocks}
            ORDER BY r.since DESC, r.id LIMIT 500`,
            [this.userId, this.userId, this.userId]
        );
        const requestRows = await this.rows(
            `SELECT ${identityColumns}, r.request_id, r.requester_id, r.created_at
            FROM social_relationship r JOIN user u ON u.id = CASE WHEN r.user_low = ? THEN r.user_high ELSE r.user_low END
            LEFT JOIN social_profile p ON p.user_id = u.id
            WHERE ? IN (r.user_low, r.user_high) AND r.status = 'pending' AND ${noBlocks}
            ORDER BY r.created_at DESC, r.id LIMIT 500`,
            [this.userId, this.userId]
        );
        const blockRows = await this.rows(
            `SELECT ${identityColumns} FROM social_block b
            JOIN user u ON u.id = b.blocked_id LEFT JOIN social_profile p ON p.user_id = u.id
            WHERE b.blocker_id = ? ORDER BY b.created_at DESC LIMIT 500`,
            [this.userId]
        );
        const profile = await this.first(
            `SELECT letters, requests, system, discoverable FROM social_profile WHERE user_id = ?`,
            [this.userId]
        );
        const letters = await this.first(
            `SELECT COUNT(CASE WHEN msg.seq > m.last_read_seq THEN 1 END) AS count,
                COALESCE(MAX(msg.seq), 0) AS latest_seq FROM social_message msg
            JOIN social_member m ON m.conversation_id = msg.conversation_id AND m.user_id = ?
            WHERE msg.sender_id != ?`,
            [this.userId, this.userId]
        );
        const notices = await this.first(
            `SELECT COUNT(*) AS count FROM social_notification WHERE recipient_id = ? AND read = 0`,
            [this.userId]
        );
        const requests = await this.first(
            `SELECT COUNT(*) AS count FROM social_relationship r
            WHERE ? IN (r.user_low, r.user_high) AND r.requester_id != ? AND r.status = 'pending' AND ${noBlocks}`,
            [this.userId, this.userId]
        );
        const summary = {
            letters: numeric(letters?.count),
            requests: numeric(requests?.count),
            notices: numeric(notices?.count),
            latestLetterSeq: numeric(letters?.latest_seq),
            total: 0
        };
        summary.total = summary.letters + summary.requests + summary.notices;
        return {
            me,
            friends: friendRows.map(row => ({
                ...userView(row),
                since: numeric(row.since),
                muted: Boolean(row.muted),
                conversationId: text(row.conversation_id)
            })),
            incoming: requestRows.filter(row => row.requester_id !== this.userId).map(row => ({
                id: text(row.request_id),
                sender: userView(row),
                createdAt: numeric(row.created_at)
            })),
            outgoing: requestRows.filter(row => row.requester_id === this.userId).map(row => ({
                id: text(row.request_id),
                recipient: userView(row),
                createdAt: numeric(row.created_at)
            })),
            blocked: blockRows.map(userView),
            summary,
            preferences: {
                letters: Boolean(profile?.letters),
                requests: Boolean(profile?.requests),
                system: Boolean(profile?.system),
                discoverable: Boolean(profile?.discoverable)
            }
        };
    }

    async incoming(after = 0) {
        const rows = await this.rows(
            `SELECT msg.seq, msg.conversation_id, m.muted, ${identityColumns}
            FROM social_message msg
            JOIN social_member m ON m.conversation_id = msg.conversation_id AND m.user_id = ?
            JOIN user u ON u.id = msg.sender_id
            LEFT JOIN social_profile p ON p.user_id = u.id
            WHERE msg.sender_id != ? AND msg.seq > ? AND msg.seq > m.last_read_seq
            ORDER BY msg.seq ASC LIMIT 101`,
            [this.userId, this.userId, after]
        );
        const selected = rows.slice(0, 100);
        return {
            items: selected.map(row => ({
                seq: numeric(row.seq),
                conversationId: text(row.conversation_id),
                peer: userView(row),
                muted: Boolean(row.muted)
            })),
            hasMore: rows.length > 100,
            nextAfter: selected.length ? numeric(selected.at(-1)?.seq) : after
        };
    }

    async search(handle: string) {
        await this.rate('search');
        const value = handle.normalize('NFKC').trim();
        if (value.length < 2 || value.length > 64) {
            throw new SocialError(400, 'INVALID_HANDLE', '请输入完整日札号或用户名。');
        }
        const found = await this.first(
            `SELECT ${identityColumns} FROM user u
            LEFT JOIN social_profile p ON p.user_id = u.id
            WHERE (u.username = ? COLLATE NOCASE OR p.handle = ? COLLATE NOCASE)
                AND COALESCE(p.discoverable, 1) = 1 LIMIT 1`,
            [value, value]
        );
        if (!found || await this.blocked(text(found.id))) throw absent();
        const user = userView(found);
        if (user.id === this.userId) return {user, relationship: 'self'};
        const relation = await this.relation(user.id);
        const relationship = relation?.status === 'accepted'
            ? 'friend'
            : relation?.status === 'pending'
            ? relation.requester_id === this.userId ? 'outgoing' : 'incoming'
            : 'none';
        return {user, relationship};
    }

    private membersFor(id: string) {
        return [
            this.statement(
                `INSERT INTO social_member(conversation_id, user_id) SELECT id, user_low
                FROM social_relationship WHERE id = ? AND status = 'accepted' ON CONFLICT DO NOTHING`,
                [id]
            ),
            this.statement(
                `INSERT INTO social_member(conversation_id, user_id) SELECT id, user_high
                FROM social_relationship WHERE id = ? AND status = 'accepted' ON CONFLICT DO NOTHING`,
                [id]
            )
        ];
    }

    private noticeFor(id: string) {
        return this.statement(
            `INSERT INTO social_notification(recipient_id, event_key, kind, title, body, created_at)
            SELECT requester_id, 'accepted:' || request_id, 'friend', '你们已经结缘',
                '彼此确认后，可以互寄文字和日签。', since
            FROM social_relationship WHERE id = ? AND status = 'accepted'
            ON CONFLICT(recipient_id, event_key) DO NOTHING`,
            [id]
        );
    }

    async request(userId: string) {
        if (!userId || userId === this.userId) throw new SocialError(400, 'INVALID_PERSON', '不能向自己递出申请。');
        const target = await this.user(userId);
        if (await this.blocked(userId)) throw absent();
        const prior = await this.relation(userId);
        if (prior?.status === 'accepted' || (prior?.status === 'pending' && prior.requester_id === this.userId)) {
            return {ok: true, relationship: prior.status === 'accepted' ? 'friend' : 'outgoing'};
        }
        await this.rate('request');
        const profile = await this.first(`SELECT discoverable FROM social_profile WHERE user_id = ?`, [userId]);
        if (profile?.discoverable === 0 && prior?.status !== 'pending') throw absent();
        const [low, high] = pair(this.userId, userId),
            id = text(prior?.id) || await conversationId(low, high),
            at = now();
        await this.db.batch([
            this.statement(
                `INSERT INTO social_relationship(id, request_id, user_low, user_high, requester_id, status, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, 'pending', ?, ? WHERE NOT EXISTS (SELECT 1 FROM social_block WHERE
                    (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?))
                    AND COALESCE((SELECT discoverable FROM social_profile WHERE user_id = ?), 1) = 1
                ON CONFLICT(user_low, user_high) DO UPDATE SET
                    status = CASE WHEN social_relationship.status = 'pending' AND social_relationship.requester_id != excluded.requester_id THEN 'accepted'
                        WHEN social_relationship.status = 'accepted' THEN 'accepted' ELSE 'pending' END,
                    since = CASE WHEN social_relationship.status = 'pending' AND social_relationship.requester_id != excluded.requester_id THEN excluded.updated_at ELSE social_relationship.since END,
                    requester_id = CASE WHEN social_relationship.status IN ('pending', 'accepted') THEN social_relationship.requester_id ELSE excluded.requester_id END,
                    request_id = CASE WHEN social_relationship.status IN ('pending', 'accepted') THEN social_relationship.request_id ELSE excluded.request_id END,
                    created_at = CASE WHEN social_relationship.status IN ('pending', 'accepted') THEN social_relationship.created_at ELSE excluded.created_at END,
                    updated_at = excluded.updated_at
                WHERE NOT EXISTS (SELECT 1 FROM social_block WHERE
                    (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?))`,
                [
                    id,
                    crypto.randomUUID(),
                    low,
                    high,
                    this.userId,
                    at,
                    at,
                    low,
                    high,
                    high,
                    low,
                    userId,
                    low,
                    high,
                    high,
                    low
                ]
            ),
            ...this.membersFor(id),
            this.noticeFor(id)
        ]);
        const result = await this.relation(target.id);
        if (!result || !result.unblocked) throw forbidden();
        return {ok: true, relationship: result.status === 'accepted' ? 'friend' : 'outgoing'};
    }

    async resolveRequest(id: string, action: string) {
        if (!['accept', 'decline'].includes(action)) {
            throw new SocialError(400, 'INVALID_ACTION', '请选择收下或暂不结缘。');
        }
        const relation = await this.first(
            `SELECT * FROM social_relationship WHERE request_id = ? AND ? IN (user_low, user_high)`,
            [id, this.userId]
        );
        if (!relation || relation.requester_id === this.userId) throw absent();
        const relationId = text(relation.id);
        const at = now();
        if (action === 'decline') {
            await this.run(
                `UPDATE social_relationship SET status = 'declined', updated_at = ?
                WHERE id = ? AND request_id = ? AND status = 'pending' AND requester_id != ?`,
                [at, relationId, id, this.userId]
            );
        } else {
            await this.db.batch([
                this.statement(
                    `UPDATE social_relationship AS r SET status = 'accepted', since = ?, updated_at = ?
                    WHERE id = ? AND request_id = ? AND status = 'pending' AND requester_id != ? AND ${noBlocks}`,
                    [at, at, relationId, id, this.userId]
                ),
                ...this.membersFor(relationId),
                this.noticeFor(relationId)
            ]);
            const result = await this.first(
                `SELECT r.status, ${noBlocks} AS unblocked FROM social_relationship r WHERE id = ? AND request_id = ?`,
                [relationId, id]
            );
            if (result?.status !== 'accepted' || !result.unblocked) {
                throw new SocialError(409, 'REQUEST_CLOSED', '这份申请已经变化，请刷新后再看。');
            }
        }
        return {ok: true};
    }

    async removeFriend(id: string) {
        const [low, high] = pair(this.userId, id);
        await this.run(
            `UPDATE social_relationship SET status = 'removed', updated_at = ?
            WHERE user_low = ? AND user_high = ? AND status = 'accepted'`,
            [now(), low, high]
        );
        return {ok: true};
    }

    async block(id: string, enabled: boolean) {
        if (id === this.userId) throw new SocialError(400, 'INVALID_PERSON', '不能屏蔽自己。');
        await this.user(id);
        const [low, high] = pair(this.userId, id);
        if (enabled) {
            await this.db.batch([
                this.statement(
                    `INSERT INTO social_block(blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
                    [this.userId, id, now()]
                ),
                this.statement(
                    `UPDATE social_relationship SET status = 'removed', updated_at = ? WHERE user_low = ? AND user_high = ?`,
                    [now(), low, high]
                )
            ]);
        } else {
            await this.run(`DELETE FROM social_block WHERE blocker_id = ? AND blocked_id = ?`, [this.userId, id]);
        }
        return {ok: true};
    }

    async openConversation(userId: string) {
        const relation = await this.relation(userId);
        if (!relation || relation.status !== 'accepted' || !relation.unblocked) throw forbidden();
        await this.db.batch(this.membersFor(text(relation.id)));
        return {id: text(relation.id)};
    }

    private messageView(row: Row): SocialMessage {
        let card: Row | null = null;
        const revoked = row.type === 'card' && Boolean(row.revoked_at || !row.source_exists);
        if (row.type === 'card' && !revoked && typeof row.snapshot_json === 'string') {
            try {
                card = JSON.parse(row.snapshot_json);
            } catch {
                card = null;
            }
        }
        return {
            id: text(row.id),
            seq: numeric(row.seq),
            clientMessageId: text(row.client_message_id),
            senderId: text(row.sender_id),
            type: row.type === 'card' ? 'card' : 'text',
            ...(row.type === 'text' ? {text: text(row.text)} : {
                shareId: text(row.id),
                revoked: revoked || !card,
                card: card ? {sentence: text(card.sentence), gloss: text(card.gloss), level: text(card.level)} : null
            }),
            createdAt: numeric(row.created_at)
        };
    }

    async conversations(page = 1) {
        const rows = await this.rows(
            `SELECT r.*, m.last_read_seq, m.muted, ${noBlocks} AS unblocked,
            (SELECT MAX(seq) FROM social_message WHERE conversation_id = r.id) AS last_seq,
            (SELECT COUNT(*) FROM social_message WHERE conversation_id = r.id AND sender_id != ? AND seq > m.last_read_seq) AS unread
            FROM social_relationship r JOIN social_member m ON m.conversation_id = r.id AND m.user_id = ?
            WHERE EXISTS (SELECT 1 FROM social_message WHERE conversation_id = r.id)
            ORDER BY last_seq DESC LIMIT 21 OFFSET ?`,
            [this.userId, this.userId, (page - 1) * 20]
        );
        const items = await Promise.all(
            rows.slice(0, 20).map(async row => {
                const message = await this.first(
                    `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
                FROM social_message msg WHERE seq = ?`,
                    [numeric(row.last_seq)]
                );
                return {
                    id: text(row.id),
                    peer: await this.user(this.peerId(row)),
                    lastMessage: message ? this.messageView(message) : null,
                    lastAt: numeric(message?.created_at),
                    unread: numeric(row.unread),
                    canSend: row.status === 'accepted' && Boolean(row.unblocked),
                    muted: Boolean(row.muted)
                };
            })
        );
        return {items, hasMore: rows.length > 20, page};
    }

    async messages(id: string, before?: number, after?: number) {
        const relation = await this.conversation(id);
        const forward = after !== undefined, limit = forward ? 100 : 30;
        const condition = forward ? 'AND msg.seq > ?' : before ? 'AND msg.seq < ?' : '';
        const params: Param[] = [id];
        if (forward) params.push(after!);
        else if (before) params.push(before);
        const rows = await this.rows(
            `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
            FROM social_message msg WHERE msg.conversation_id = ? ${condition}
            ORDER BY msg.seq ${forward ? 'ASC' : 'DESC'} LIMIT ${limit + 1}`,
            params
        );
        const selected = rows.slice(0, limit);
        if (!forward) selected.reverse();
        return {
            id,
            peer: await this.user(this.peerId(relation)),
            canSend: relation.status === 'accepted' && Boolean(relation.unblocked),
            muted: Boolean(relation.muted),
            items: selected.map(row => this.messageView(row)),
            hasMore: rows.length > limit,
            nextBefore: numeric(selected[0]?.seq),
            nextAfter: numeric(selected.at(-1)?.seq),
            lastReadSeq: numeric(relation.last_read_seq)
        };
    }

    async send(id: string, input: Row) {
        await this.conversation(id);
        const key = text(input.clientMessageId);
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
            throw new SocialError(400, 'INVALID_MESSAGE_ID', '这封信的编号无效，请重新打开。');
        }
        const existing = await this.first(
            `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
            FROM social_message msg WHERE conversation_id = ? AND sender_id = ? AND client_message_id = ?`,
            [id, this.userId, key]
        );
        if (existing) return this.messageView(existing);
        const type = input.type;
        let body: string | null = null, sourceId: string | null = null, snapshot: string | null = null;
        if (type === 'text') {
            body = text(input.text).trim();
            if (!body || [...body].length > 1000) {
                throw new SocialError(400, 'INVALID_TEXT', '请写下 1 到 1,000 字的问候。');
            }
        } else if (type === 'card') {
            sourceId = text(input.cardId);
            const card = await this.first(
                `SELECT id, sentence, sentence_html, gloss, reading, reading_tokens, audio_url, illustration_url, level, created_at
                FROM card_history WHERE id = ? AND user_id = ?`,
                [sourceId, this.userId]
            );
            if (!card) throw absent();
            let readingTokens: unknown[] | null = null;
            if (card.reading_tokens) {
                try {
                    const parsed: unknown = JSON.parse(text(card.reading_tokens));
                    if (Array.isArray(parsed)) readingTokens = parsed;
                } catch { /* 旧卡分词损坏时仍保留完整日文、中文与读音。 */ }
            }
            snapshot = JSON.stringify({
                id: text(card.id),
                sentence: text(card.sentence),
                sentenceHtml: text(card.sentence_html),
                gloss: text(card.gloss),
                reading: text(card.reading),
                readingTokens,
                audioUrl: card.audio_url,
                illustrationUrl: card.illustration_url,
                level: text(card.level),
                createdAt: text(card.created_at)
            });
        } else throw new SocialError(400, 'INVALID_TYPE', '这封信暂不支持这种内容。');
        await this.rate('send');
        try {
            await this.run(
                `INSERT INTO social_message(id, conversation_id, sender_id, client_message_id, type, text, source_card_id, snapshot_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(conversation_id, sender_id, client_message_id) DO NOTHING`,
                [crypto.randomUUID(), id, this.userId, key, text(type), body, sourceId, snapshot, now()]
            );
        } catch (error) {
            if (error instanceof Error && /SOCIAL_SEND_FORBIDDEN|SOCIAL_CARD_FORBIDDEN/.test(error.message)) {
                throw forbidden();
            }
            throw error;
        }
        const stored = await this.first(
            `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
            FROM social_message msg WHERE conversation_id = ? AND sender_id = ? AND client_message_id = ?`,
            [id, this.userId, key]
        );
        if (!stored) throw new Error('SOCIAL_SEND_NOT_STORED');
        return this.messageView(stored);
    }

    async read(id: string, seq: number) {
        await this.conversation(id);
        if (!Number.isSafeInteger(seq) || seq < 0) throw new SocialError(400, 'INVALID_CURSOR', '阅读位置无效。');
        await this.run(
            `UPDATE social_member SET last_read_seq = MAX(last_read_seq, MIN(?,
            COALESCE((SELECT MAX(seq) FROM social_message WHERE conversation_id = ?), 0)))
            WHERE conversation_id = ? AND user_id = ?`,
            [seq, id, id, this.userId]
        );
        return {ok: true};
    }

    async mute(id: string, muted: boolean) {
        await this.conversation(id);
        await this.run(`UPDATE social_member SET muted = ? WHERE conversation_id = ? AND user_id = ?`, [
            muted ? 1 : 0,
            id,
            this.userId
        ]);
        return {ok: true};
    }

    async share(id: string) {
        const row = await this.first(
            `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
            FROM social_message msg JOIN social_member m ON m.conversation_id = msg.conversation_id
            WHERE msg.id = ? AND msg.type = 'card' AND m.user_id = ?`,
            [id, this.userId]
        );
        if (!row) throw absent();
        const revoked = Boolean(row.revoked_at || !row.source_exists || !row.snapshot_json);
        let card = null;
        if (!revoked) {
            try {
                card = JSON.parse(text(row.snapshot_json));
            } catch { /* 损坏快照保持收回态，不落回源卡权限。 */ }
        }
        return {id, card, sender: await this.user(text(row.sender_id)), revoked: revoked || !card};
    }

    async revokeShare(id: string) {
        const changed = await this.run(
            `UPDATE social_message SET revoked_at = COALESCE(revoked_at, ?), snapshot_json = NULL
            WHERE id = ? AND sender_id = ? AND type = 'card'`,
            [now(), id, this.userId]
        );
        if (!changed) throw absent();
        return {ok: true};
    }

    async profile(id: string) {
        const relation = await this.relation(id);
        if (!relation) throw absent();
        const membership = await this.first(`SELECT 1 FROM social_member WHERE conversation_id = ? AND user_id = ?`, [
            text(relation.id),
            this.userId
        ]);
        if (!membership) throw absent();
        const rows = await this.rows(
            `SELECT msg.*, EXISTS(SELECT 1 FROM card_history c WHERE c.id = msg.source_card_id) AS source_exists
            FROM social_message msg WHERE conversation_id = ? AND sender_id = ? AND type = 'card'
            ORDER BY seq DESC LIMIT 30`,
            [text(relation.id), id]
        );
        return {
            user: await this.user(id),
            friend: relation.status === 'accepted' && Boolean(relation.unblocked),
            since: numeric(relation.since),
            shared: rows.map(row => this.messageView(row)).filter(message => !message.revoked).map(message => ({
                id: message.id,
                card: message.card
            }))
        };
    }

    async notifications(page = 1) {
        // Capture the cutoff before listing, so a notification arriving during this
        // request cannot accidentally be included in the caller's "mark all" action.
        const cutoff = await this.first(
            `SELECT COALESCE(MAX(id), 0) AS max_id FROM social_notification WHERE recipient_id = ?`,
            [this.userId]
        );
        const maxId = numeric(cutoff?.max_id);
        const rows = await this.rows(
            `SELECT id, title, body, created_at, read FROM social_notification
            WHERE recipient_id = ? AND id <= ? ORDER BY id DESC LIMIT 21 OFFSET ?`,
            [this.userId, maxId, (page - 1) * 20]
        );
        return {
            items: rows.slice(0, 20).map(row => ({
                id: text(String(row.id)),
                title: text(row.title),
                body: text(row.body),
                createdAt: numeric(row.created_at),
                read: Boolean(row.read)
            })),
            hasMore: rows.length > 20,
            page,
            maxId
        };
    }

    async readNotifications(input: Row) {
        const id = input.id ? positiveInteger(input.id, 0) : 0, through = positiveInteger(input.through, 0);
        if (!id && !through) throw new SocialError(400, 'INVALID_CURSOR', '请选择要收好的通知。');
        await this.run(
            `UPDATE social_notification SET read = 1 WHERE recipient_id = ? AND ${id ? 'id = ?' : 'id <= ?'}`,
            [this.userId, id || through]
        );
        return {ok: true};
    }

    async preferences(input: Row) {
        await this.ensureProfile();
        for (const key of ['letters', 'requests', 'system', 'discoverable']) {
            if (key in input && typeof input[key] !== 'boolean') {
                throw new SocialError(400, 'INVALID_PREFERENCE', '偏好设置无效。');
            }
        }
        const statements = ['letters', 'requests', 'system', 'discoverable'].filter(key =>
            typeof input[key] === 'boolean'
        )
            .map(key =>
                this.statement(`UPDATE social_profile SET ${key} = ? WHERE user_id = ?`, [
                    input[key] ? 1 : 0,
                    this.userId
                ])
            );
        if (statements.length) await this.db.batch(statements);
        return {ok: true};
    }

    async report(input: Row) {
        const userId = text(input.userId),
            reason = text(input.reason).trim(),
            messageId = text(input.messageId) || null;
        if (!userId || userId === this.userId || [...reason].length < 2 || [...reason].length > 500) {
            throw new SocialError(400, 'INVALID_REPORT', '请写下 2 到 500 字的具体情况。');
        }
        const relation = await this.relation(userId);
        if (!relation) throw absent();
        if (messageId) {
            const visible = await this.first(
                `SELECT 1 FROM social_message msg JOIN social_member m ON m.conversation_id = msg.conversation_id
                WHERE msg.id = ? AND msg.sender_id = ? AND m.user_id = ?`,
                [messageId, userId, this.userId]
            );
            if (!visible) throw absent();
        }
        await this.rate('report');
        await this.run(
            `INSERT INTO social_report(id, reporter_id, reported_id, message_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), this.userId, userId, messageId, reason, now()]
        );
        return {ok: true};
    }
}
