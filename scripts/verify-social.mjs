import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// End-to-end smoke check for an isolated local D1 only. Never creates production users.
const origin = new URL(process.argv[2] || 'http://127.0.0.1:8788').origin;
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
    throw new Error('This fixture check only runs against a local server.');
}
const suffix = Date.now().toString(36);
const password = 'Rizha_local_QA_2026!';
async function request (path, {cookie, method = 'GET', body} = {}) {
    const response = await fetch(origin + path, {
        method,
        headers: {
            Origin: origin,
            ...(cookie ? {Cookie: cookie} : {}),
            ...(body ? {'Content-Type': 'application/json'} : {})
        },
        ...(body ? {body: JSON.stringify(body)} : {})
    });
    const value = await response.json();
    return {response, value};
}
async function signup (letter) {
    const username = `qa_${letter}_${suffix}`;
    const result = await request('/api/auth/sign-up/email', {
        method: 'POST',
        body: {name: `验收${letter.toUpperCase()}`, email: `${username}@example.test`, username, password}
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.value));
    const cookie = result.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.ok(cookie);
    return {
        id: result.value.user.id,
        username,
        call: (path, options = {}) => request('/api/social' + path, {...options, cookie})
    };
}

const unauthenticated = await request('/api/social');
assert.equal(unauthenticated.response.status, 401);
const alice = await signup('a');
const bob = await signup('b');
const carol = await signup('c');
const empty = await alice.call('');
assert.equal(empty.response.status, 200, JSON.stringify(empty.value));
assert.deepEqual(empty.value.friends, []);
const found = await alice.call(`/search?handle=${encodeURIComponent(bob.username)}`);
assert.equal(found.response.status, 200);
assert.equal(found.value.user.id, bob.id);
assert.equal(found.value.user.email, undefined);
await alice.call('/requests', {method: 'POST', body: {userId: bob.id}});
await alice.call('/requests', {method: 'POST', body: {userId: bob.id}});
const pending = (await bob.call('')).value;
assert.equal(pending.incoming.length, 1);
assert.equal(pending.summary.requests, 1);
const accepted = await bob.call(`/requests/${pending.incoming[0].id}`, {
    method: 'POST', body: {action: 'accept'}
});
assert.ok(accepted.response.ok, JSON.stringify(accepted.value));
const friends = (await alice.call('')).value;
assert.equal(friends.friends.length, 1);
const opened = await alice.call('/conversations', {method: 'POST', body: {userId: bob.id}});
assert.ok(opened.value.id);
const conversation = opened.value.id;
const key = randomUUID();
const sending = {method: 'POST', body: {clientMessageId: key, type: 'text', text: '今日も、一緒に。'}};
const first = await alice.call(`/conversations/${conversation}/messages`, sending);
assert.ok(first.response.ok, JSON.stringify(first.value));
const duplicate = await alice.call(`/conversations/${conversation}/messages`, sending);
assert.equal(duplicate.value.id, first.value.id);
assert.equal((await bob.call('')).value.summary.letters, 1);
const thread = await bob.call(`/conversations/${conversation}`);
assert.equal(thread.value.items.length, 1);
assert.equal(thread.value.items[0].text, '今日も、一緒に。');
assert.equal((await carol.call(`/conversations/${conversation}`)).response.status, 404);
assert.equal((await carol.call(`/profile/${alice.id}`)).response.status, 404);
const foreignCard = await bob.call(`/conversations/${conversation}/messages`, {
    method: 'POST', body: {clientMessageId: randomUUID(), type: 'card', cardId: 'not-owned'}
});
assert.ok(foreignCard.response.status >= 400);
await bob.call(`/conversations/${conversation}/read`, {method: 'PUT', body: {seq: first.value.seq}});
assert.equal((await bob.call('')).value.summary.letters, 0);
await bob.call(`/conversations/${conversation}/mute`, {method: 'PUT', body: {muted: true}});
assert.equal((await bob.call(`/conversations/${conversation}`)).value.muted, true);
await bob.call('/preferences', {method: 'PUT', body: {discoverable: false}});
assert.equal((await carol.call(`/search?handle=${bob.username}`)).response.status, 404);
await bob.call('/reports', {method: 'POST', body: {userId: alice.id, messageId: first.value.id, reason: '本地权限验收'}});
await bob.call(`/friends/${alice.id}`, {method: 'DELETE'});
const blockedSend = await alice.call(`/conversations/${conversation}/messages`, {
    method: 'POST', body: {clientMessageId: randomUUID(), type: 'text', text: '不能寄出'}
});
assert.ok(blockedSend.response.status >= 400);
assert.equal((await alice.call(`/conversations/${conversation}`)).value.items.length, 1);
await bob.call(`/blocks/${alice.id}`, {method: 'POST'});
assert.ok((await alice.call('/requests', {method: 'POST', body: {userId: bob.id}})).response.status >= 400);
await bob.call(`/blocks/${alice.id}`, {method: 'DELETE'});
assert.equal((await bob.call('')).value.friends.length, 0);
console.log(JSON.stringify({
    ok: true,
    checks: 'auth, empty state, exact search, deduplication, accept, send/retry, unread/read, privacy, mute, report, remove/archive, block/unblock',
    origin,
    localFixture: {username: alice.username, password}
}, null, 2));
