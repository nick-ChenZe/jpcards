import test from 'node:test';
import assert from 'node:assert/strict';
import {appendOutbox, applyShareVerifications, concealSharedPreviews, incomingBanner, mergeLetters, noticeReadCutoff, prepareSharedLetter, reconcileOutbox, restoreOutbox} from '../src/lib/social.ts';

test('a shared card retry after a lost response or reload reuses the same message ID', () => {
    const initial = prepareSharedLetter([], 'card-a', () => 'first-id');
    const restored = restoreOutbox(JSON.parse(JSON.stringify(initial.outbox)));
    assert.equal(restored[0].status, 'failed');
    const retry = prepareSharedLetter(restored, 'card-a', () => 'wrong-new-id');
    assert.equal(retry.letter.clientMessageId, 'first-id');
    assert.equal(retry.outbox.length, 1);
    const different = prepareSharedLetter(retry.outbox, 'card-b', () => 'second-id');
    assert.deepEqual(different.outbox.map(item => item.clientMessageId), ['first-id', 'second-id']);
});

test('notification cutoff is a valid server snapshot ID, never an invalid or missing value', () => {
    assert.equal(noticeReadCutoff(132), 132);
    for (const invalid of [undefined, null, 0, -1, 1.5, '132', Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal(noticeReadCutoff(invalid), 0);
    }
});

test('a muted sender and active thread do not silence another conversation', () => {
    const peer = {id: 'p', name: '友', handle: 'FRIEND'};
    const events = [
        {seq: 21, conversationId: 'muted', peer, muted: true},
        {seq: 22, conversationId: 'active', peer, muted: false},
        {seq: 23, conversationId: 'other', peer, muted: false}
    ];
    assert.equal(incomingBanner(events, 'active')?.conversationId, 'other');
    assert.equal(incomingBanner(events.slice(0, 2), 'active'), undefined);
    assert.equal(incomingBanner(events.slice(1, 2))?.seq, 22);
});

test('a peer cannot acknowledge our pending letter by reusing its client ID', () => {
    const {outbox} = prepareSharedLetter([], 'card-a', () => 'same-key');
    const other = {id: 'm1', seq: 1, senderId: 'peer', clientMessageId: 'same-key', type: 'text', text: 'x', createdAt: 1};
    assert.equal(reconcileOutbox(outbox, [other], 'me').length, 1);
    assert.equal(reconcileOutbox(outbox, [{...other, senderId: 'me'}], 'me').length, 0);
});

test('a full outbox never discards an older draft or silently truncates a previously saved queue', () => {
    const letters = Array.from({length: 50}, (_, index) => ({clientMessageId: `pending-${index}`, type: 'text', text: `信${index}`, status: 'failed'}));
    assert.equal(appendOutbox(letters, {clientMessageId: 'next', type: 'text', text: '保留的草稿', status: 'sending'}), null);
    assert.equal(letters[0].text, '信0');
    assert.throws(() => prepareSharedLetter(letters, 'card-a', () => 'new-card'), /待寄书信/);
    const oldOversized = [...letters, {clientMessageId: 'old-51', type: 'text', text: '旧信', status: 'failed'}];
    assert.equal(restoreOutbox(oldOversized).length, 51);
    assert.equal(restoreOutbox(oldOversized)[0].text, '信0');
});

test('older card previews are hidden while checking and stay hidden after revocation or a failed check', () => {
    const card = {id: 'old', shareId: 'share-old', seq: 1, senderId: 'peer', clientMessageId: 'one', type: 'card', card: {sentence: '秘密', gloss: '秘密', level: 'N5'}, createdAt: 1};
    const other = {...card, id: 'unavailable', shareId: 'share-unavailable', seq: 2};
    const text = {id: 'text', seq: 3, senderId: 'peer', clientMessageId: 'two', type: 'text', text: '你好', createdAt: 2};
    const concealed = concealSharedPreviews([card, other, text], 'checking');
    assert.equal(concealed[0].card, null);
    assert.equal(concealed[0].cardVerification, 'checking');
    assert.equal(concealed[2].text, '你好');
    const checked = applyShareVerifications(concealed, [
        {id: 'share-old', state: 'revoked'},
        {id: 'share-unavailable', state: 'unavailable'}
    ]);
    assert.equal(checked[0].revoked, true);
    assert.equal(checked[0].card, null);
    assert.equal(checked[1].cardVerification, 'unavailable');
    assert.equal(checked[1].card, null);
    const recovered = applyShareVerifications(checked, [{id: 'share-unavailable', state: 'available', card: {sentence: '新内容', gloss: '新内容', level: 'N4'}}]);
    assert.equal(recovered[1].card.sentence, '新内容');
    assert.equal(recovered[1].cardVerification, undefined);
    const fresh = {...card, revoked: true, card: null};
    assert.equal(mergeLetters(concealed, [fresh])[0].revoked, true);
});
