import type {AnyD1Database} from 'drizzle-orm/d1';
import {Hono} from 'hono';
import {readdirSync, readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe, expect, it} from 'vitest';
import type {Env} from '../../types.js';
import {socialRoutes} from '../routes.js';
import {SocialError, SocialService} from '../service.js';

type Param = string | number | null;

function fixture () {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    const directory = new URL('../../../migrations/', import.meta.url);
    // Test the actual incremental migration chain, including the existing card schema.
    for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
        sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
    }
    const prepare = (query: string, params: Param[] = []) => {
        const execute = () => {
            const statement = sqlite.prepare(query);
            if (/^\s*(SELECT|WITH|PRAGMA)/i.test(query)) {
                return {success: true, results: statement.all(...params), meta: {changes: 0}};
            }
            const info = statement.run(...params);
            return {success: true, results: [], meta: {changes: Number(info.changes)}};
        };
        return {
            query,
            params,
            bind(...values: Param[]) {
                return prepare(query, values);
            },
            async all() {
                return execute();
            },
            async run() {
                return execute();
            },
            execute
        };
    };
    const database = {
        prepare,
        async batch(statements: ReturnType<typeof prepare>[]) {
            sqlite.exec('BEGIN');
            try {
                const results = statements.map(statement => statement.execute());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        }
    };
    for (const [id, username] of [['a', 'aoba'], ['b', 'bamboo'], ['c', 'cicada']]) {
        sqlite.prepare(
            `INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,username) VALUES(?,?,?,0,1,1,?)`
        )
            .run(id, `名前-${id}`, `${id}@private.example`, username);
    }
    const db = database as unknown as AnyD1Database;
    const a = new SocialService(db, 'a'), b = new SocialService(db, 'b'), c = new SocialService(db, 'c');
    return {sqlite, db, a, b, c};
}

async function connect (f: ReturnType<typeof fixture>) {
    await f.a.request('b');
    const request = (await f.b.overview()).incoming[0];
    await f.b.resolveRequest(request.id, 'accept');
    return (await f.a.overview()).friends[0].conversationId;
}

const send = (service: SocialService, conversationId: string, key: string, message = 'こんにちは') =>
    service.send(conversationId, {clientMessageId: key, type: 'text', text: message});
const failCode = async (promise: Promise<unknown>, status: number) => expect(promise).rejects.toMatchObject({status});

describe('production social D1 rules', () => {
    it('creates an empty account view and exact lookup without exposing account email or history', async () => {
        const f = fixture();
        const overview = await f.a.overview();
        expect(overview.me).toEqual({id: 'a', name: '名前-a', handle: 'aoba'});
        expect(overview.friends).toEqual([]);
        expect(overview.summary).toEqual({letters: 0, requests: 0, notices: 0, total: 0, latestLetterSeq: 0});
        expect(JSON.stringify(overview)).not.toContain('private.example');
        expect((await f.a.search('BAMBOO')).user.id).toBe('b');
        await failCode(f.a.search('bamb'), 404);
        await f.b.preferences({discoverable: false});
        await failCode(f.a.search('bamboo'), 404);
        await failCode(f.a.request('b'), 404);
    });

    it('deduplicates concurrent reciprocal requests into one confirmed pair, conversation and notification', async () => {
        const f = fixture();
        await Promise.all([f.a.request('b'), f.b.request('a')]);
        const left = await f.a.overview(), right = await f.b.overview();
        expect(left.friends).toHaveLength(1);
        expect(right.friends).toHaveLength(1);
        expect(left.friends[0].conversationId).toBe(right.friends[0].conversationId);
        expect(left.incoming).toHaveLength(0);
        expect(right.outgoing).toHaveLength(0);
        expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM social_relationship').get()?.n).toBe(1);
        expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM social_member').get()?.n).toBe(2);
        expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM social_notification').get()?.n).toBe(1);
        await f.a.request('b');
        expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM social_notification').get()?.n).toBe(1);
    });

    it('only lets the recipient accept, supports decline without a rejection notification, and requires friendship to write', async () => {
        const f = fixture();
        await failCode(f.a.openConversation('b'), 403);
        await f.a.request('b');
        await f.a.request('b');
        const request = (await f.b.overview()).incoming[0];
        expect((await f.b.overview()).summary.requests).toBe(1);
        await failCode(f.c.resolveRequest(request.id, 'accept'), 404);
        await failCode(f.a.resolveRequest(request.id, 'accept'), 404);
        await f.b.resolveRequest(request.id, 'decline');
        expect((await f.a.notifications()).items).toHaveLength(0);
        expect((await f.b.overview()).summary.requests).toBe(0);
        await failCode(f.a.openConversation('b'), 403);
        await f.a.request('b');
        await failCode(f.b.resolveRequest(request.id, 'accept'), 404);
        const newRequest = (await f.b.overview()).incoming[0];
        await f.b.resolveRequest(newRequest.id, 'accept');
        await f.b.resolveRequest(newRequest.id, 'accept');
        expect((await f.a.notifications()).items).toHaveLength(1);
    });

    it('persists one server-ordered letter per idempotency key and replays the original body on a changed retry', async () => {
        const f = fixture(), id = await connect(f);
        const first = await send(f.a, id, 'letter-001', '  <script>これは文字です</script>  ');
        const retry = await send(f.a, id, 'letter-001', 'different body');
        expect(retry.id).toBe(first.id);
        expect(retry.text).toBe('<script>これは文字です</script>');
        expect((await f.b.overview()).summary.letters).toBe(1);
        expect((await f.a.overview()).summary.letters).toBe(0);
        const second = await send(f.b, id, 'letter-002');
        expect(second.seq).toBeGreaterThan(first.seq);
        await failCode(send(f.c, id, 'letter-003'), 404);
        await failCode(f.c.messages(id), 404);
        await failCode(send(f.a, id, 'short'), 400);
        await failCode(send(f.a, id, 'letter-too-long', 'あ'.repeat(1001)), 400);
        expect((await send(f.a, id, 'letter-unicode', '𠮷'.repeat(1000))).text).toHaveLength(2000);
        expect((await f.b.messages(id)).items.map(message => message.seq)).toEqual(
            expect.arrayContaining([first.seq, second.seq])
        );
    });

    it('keeps read positions monotonic and bounded by the authorized conversation, with incremental and historical cursors', async () => {
        const f = fixture(), id = await connect(f);
        const sent = [];
        for (let index = 0; index < 42; index++) {
            sent.push(await send(f.a, id, `history-${index.toString().padStart(3, '0')}`));
        }
        const latest = await f.b.messages(id);
        expect(latest.items).toHaveLength(30);
        expect(latest.hasMore).toBe(true);
        const older = await f.b.messages(id, latest.nextBefore);
        expect(older.items).toHaveLength(12);
        expect(older.hasMore).toBe(false);
        const after = await f.b.messages(id, undefined, sent[4].seq);
        expect(after.items).toHaveLength(37);
        expect(after.items[0].seq).toBe(sent[5].seq);
        await f.b.read(id, sent[20].seq);
        await f.b.read(id, sent[2].seq);
        expect((await f.b.overview()).summary.letters).toBe(21);
        await f.b.read(id, Number.MAX_SAFE_INTEGER);
        expect((await f.b.messages(id)).lastReadSeq).toBe(sent.at(-1)?.seq);
        expect((await f.b.overview()).summary.letters).toBe(0);
        await failCode(f.c.read(id, sent.at(-1)!.seq), 404);
    });

    it('lists only the current user’s unread incoming messages after a cursor, even if their unread count is unchanged', async () => {
        const f = fixture(), id = await connect(f);
        const first = await send(f.b, id, 'incoming-first');
        await f.a.read(id, first.seq);
        const second = await send(f.b, id, 'incoming-second');
        await send(f.a, id, 'outgoing-later');
        await f.a.mute(id, true);
        expect((await f.a.overview()).summary.latestLetterSeq).toBe(second.seq);
        const incoming = await f.a.incoming(0);
        expect(incoming.items).toEqual([{
            seq: second.seq,
            conversationId: id,
            peer: {id: 'b', name: '名前-b', handle: 'bamboo'},
            muted: true
        }]);
        expect(incoming.nextAfter).toBe(second.seq);
        expect((await f.c.incoming(0)).items).toEqual([]);
        expect((await f.a.incoming(second.seq)).items).toEqual([]);
    });

    it('pages unread incoming events by sequence without skipping the next batch', async () => {
        const f = fixture(), id = await connect(f);
        const insert = f.sqlite.prepare(`INSERT INTO social_message
            (id,conversation_id,sender_id,client_message_id,type,text,created_at)
            VALUES(?,?, 'b',?,'text','こんにちは',1)`);
        for (let index = 0; index < 105; index++) insert.run(`id-${index}`, id, `client-${index}`);
        const first = await f.a.incoming(0);
        expect(first.items).toHaveLength(100);
        expect(first.hasMore).toBe(true);
        const second = await f.a.incoming(first.nextAfter);
        expect(second.items).toHaveLength(5);
        expect(second.hasMore).toBe(false);
        expect(second.items[0].seq).toBeGreaterThan(first.nextAfter);
    });

    it('checks remove/block inside the message write, preserves archive access and never restores friendship on unblock', async () => {
        const f = fixture(), id = await connect(f);
        const first = await send(f.a, id, 'archive-first');
        await f.a.removeFriend('b');
        await failCode(send(f.b, id, 'archive-blocked'), 403);
        expect((await f.a.messages(id)).items[0].id).toBe(first.id);
        expect((await f.b.messages(id)).canSend).toBe(false);
        await f.b.request('a');
        await f.a.resolveRequest((await f.a.overview()).incoming[0].id, 'accept');
        await f.b.block('a', true);
        await failCode(send(f.a, id, 'blocked-letter'), 403);
        await failCode(f.a.request('b'), 404);
        await failCode(f.a.search('bamboo'), 404);
        await f.b.block('a', false);
        await failCode(send(f.a, id, 'unblocked-letter'), 403);
        expect((await f.b.messages(id)).items).toHaveLength(1);
        expect(() =>
            f.sqlite.prepare(
                `INSERT INTO social_message(id, conversation_id, sender_id, client_message_id, type, text, created_at)
            VALUES('malicious', ?, 'a', 'bypass-id', 'text', 'no', 1)`
            ).run(id)
        ).toThrow('SOCIAL_SEND_FORBIDDEN');
    });

    it('shares only owned cards, hides source history from third parties and immediately revokes every summary', async () => {
        const f = fixture(), id = await connect(f);
        f.sqlite.prepare(`INSERT INTO card_history(id,user_id,sentence,sentence_html,gloss,reading,level)
            VALUES('card-a','a','今日は晴れ。','今日は晴れ。','今天晴朗。','きょうははれ。','N5')`).run();
        await failCode(f.b.send(id, {clientMessageId: 'foreign-card', type: 'card', cardId: 'card-a'}), 404);
        const shared = await f.a.send(id, {clientMessageId: 'card-message', type: 'card', cardId: 'card-a'});
        expect((await f.b.share(shared.id)).card?.sentence).toBe('今日は晴れ。');
        expect((await f.b.profile('a')).shared).toHaveLength(1);
        await failCode(f.c.share(shared.id), 404);
        await failCode(f.c.profile('a'), 404);
        await failCode(f.b.revokeShare(shared.id), 404);
        await f.a.revokeShare(shared.id);
        expect((await f.b.share(shared.id)).revoked).toBe(true);
        expect((await f.b.messages(id)).items[0].card).toBeNull();
        expect((await f.b.conversations()).items[0].lastMessage?.card).toBeNull();
        expect((await f.b.profile('a')).shared).toHaveLength(0);
        const second = await f.a.send(id, {clientMessageId: 'card-message-2', type: 'card', cardId: 'card-a'});
        f.sqlite.prepare(`DELETE FROM card_history WHERE id = 'card-a'`).run();
        expect((await f.b.share(second.id)).revoked).toBe(true);
    });

    it('only marks notifications through the provided cutoff, and stores preferences/mute independently from unread', async () => {
        const f = fixture(), id = await connect(f);
        const snapshot = await f.a.notifications();
        expect(snapshot.maxId).toBe(Number(snapshot.items[0].id));
        f.sqlite.prepare(`INSERT INTO social_notification(recipient_id,event_key,kind,title,body,created_at)
            VALUES('a','later','system','新通知','保留未读',2)`).run();
        await f.a.readNotifications({through: snapshot.maxId});
        expect((await f.a.overview()).summary.notices).toBe(1);
        await send(f.b, id, 'mute-test');
        await f.a.mute(id, true);
        await f.a.preferences({letters: false});
        const overview = await f.a.overview();
        expect(overview.preferences.letters).toBe(false);
        expect(overview.friends[0].muted).toBe(true);
        expect(overview.summary.letters).toBe(1);
    });

    it('returns a current-user notification cutoff even when viewing an older page', async () => {
        const f = fixture();
        expect((await f.a.notifications()).maxId).toBe(0);
        for (let index = 0; index < 23; index++) {
            f.sqlite.prepare(`INSERT INTO social_notification(recipient_id,event_key,kind,title,body,created_at)
                VALUES('a',?,'system','日札','内容',?)`).run(`page-${index}`, index + 1);
        }
        const newest = await f.a.notifications(1);
        f.sqlite.prepare(`INSERT INTO social_notification(recipient_id,event_key,kind,title,body,created_at)
            VALUES('b','other','system','另一位','内容',100)`).run();
        const older = await f.a.notifications(2);
        expect(older.items.length).toBe(3);
        expect(older.maxId).toBe(newest.maxId);
        expect(older.maxId).toBe(Number(newest.items[0].id));
    });

    it('rate limits discovery, requests, sending and reports in persistent D1 buckets', async () => {
        const f = fixture();
        for (let index = 0; index < 30; index++) await f.a.search('bamboo');
        await failCode(f.a.search('bamboo'), 429);
        const id = await connect(f);
        for (let index = 0; index < 60; index++) await send(f.a, id, `rate-${index.toString().padStart(4, '0')}`);
        await failCode(send(f.a, id, 'rate-exceeded'), 429);
        for (let index = 0; index < 10; index++) await f.a.report({userId: 'b', reason: '不合适的来信'});
        await failCode(f.a.report({userId: 'b', reason: '过多来信'}), 429);
        const other = fixture();
        for (let index = 0; index < 20; index++) await other.a.rate('request');
        await failCode(other.a.rate('request'), 429);
    });
});

describe('social HTTP boundaries', () => {
    it('requires login, same-origin mutations and bounded valid JSON', async () => {
        const f = fixture();
        const app = new Hono<{Bindings: Env; Variables: {session: {user: {id: string;};} | null;};}>();
        app.use('*', async (c, next) => {
            c.set('session', c.req.header('x-test-user') ? {user: {id: c.req.header('x-test-user')!}} : null);
            await next();
        });
        app.route('/api/social', socialRoutes);
        const env = {DB: f.db} as Env;
        expect((await app.request('/api/social', {}, env)).status).toBe(401);
        const headers = {'x-test-user': 'a', 'content-type': 'application/json'};
        expect(
            (await app.request(
                '/api/social/requests',
                {method: 'POST', headers, body: JSON.stringify({userId: 'b'})},
                env
            )).status
        ).toBe(403);
        const foreign = await app.request('/api/social/requests', {
            method: 'POST',
            headers: {...headers, origin: 'https://evil.example'},
            body: JSON.stringify({userId: 'b'})
        }, env);
        expect(foreign.status).toBe(403);
        const malformed = await app.request('/api/social/requests', {
            method: 'POST',
            headers: {...headers, origin: 'http://localhost'},
            body: 'invalid'
        }, env);
        expect(malformed.status).toBe(400);
        const huge = await app.request('/api/social/requests', {
            method: 'POST',
            headers: {...headers, origin: 'http://localhost'},
            body: JSON.stringify({userId: 'b', extra: 'x'.repeat(17000)})
        }, env);
        expect(huge.status).toBe(413);
        const overview = await app.request('/api/social', {headers}, env);
        expect(overview.status).toBe(200);
        expect(overview.headers.get('cache-control')).toBe('no-store');
        const valid = await app.request('/api/social/requests', {
            method: 'POST',
            headers: {...headers, origin: 'http://localhost'},
            body: JSON.stringify({userId: 'b'})
        }, env);
        expect(valid.status).toBe(200);
    });

    it('represents domain failures without leaking SQL or account secrets', () => {
        const error = new SocialError(403, 'RELATIONSHIP_REQUIRED', '先确认好友关系。');
        expect(error.status).toBe(403);
        expect(error.message).not.toContain('SELECT');
    });
});
