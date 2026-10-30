import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {loadReturnVisitSentence, returnVisitSentence, visibleReturnVisit} from '../src/lib/returnVisit.ts';

function historyBody (sentence, total = 1) {
    return {
        items: sentence === undefined ? [] : [{sentence}],
        pagination: {page: 1, pageSize: 1, total, totalPages: total > 0 ? 1 : 0}
    };
}

function jsonResponse (body, ok = true) {
    return {
        ok,
        json: async () => body
    };
}

test('yesterday sentence and an empty today show the trimmed line', () => {
    assert.equal(returnVisitSentence({
        yesterdayOk: true,
        yesterdayBody: historyBody('  昨日の空は青い。  '),
        todayOk: true,
        todayBody: historyBody(undefined, 0),
        drawnNow: false
    }), '昨日の空は青い。');
});

test('the newest yesterday sentence is the first non-empty item', () => {
    assert.equal(returnVisitSentence({
        yesterdayOk: true,
        yesterdayBody: {
            items: [{sentence: '  '}, {sentence: '新しい一句'}, {sentence: '古い一句'}],
            pagination: {total: 2}
        },
        todayOk: true,
        todayBody: historyBody(undefined, 0),
        drawnNow: false
    }), '新しい一句');
});

test('no yesterday card is a zero node', () => {
    assert.equal(returnVisitSentence({
        yesterdayOk: true,
        yesterdayBody: historyBody(undefined, 0),
        todayOk: true,
        todayBody: historyBody(undefined, 0),
        drawnNow: false
    }), null);
    assert.equal(returnVisitSentence({
        yesterdayOk: true,
        yesterdayBody: historyBody('   ', 1),
        todayOk: true,
        todayBody: historyBody(undefined, 0),
        drawnNow: false
    }), null);
});

test('a card already saved today hides the contrast', () => {
    assert.equal(returnVisitSentence({
        yesterdayOk: true,
        yesterdayBody: historyBody('昨日の一句'),
        todayOk: true,
        todayBody: historyBody('今日の一句', 1),
        drawnNow: false
    }), null);
});

test('drawing or an open card collapses the contrast', () => {
    assert.equal(visibleReturnVisit('昨日の一句', 'empty'), '昨日の一句');
    assert.equal(visibleReturnVisit('昨日の一句', 'drawing'), null);
    assert.equal(visibleReturnVisit('昨日の一句', 'hero'), null);
    assert.equal(visibleReturnVisit('   ', 'empty'), null);
    assert.equal(visibleReturnVisit(null, 'empty'), null);
});

test('a failed or unreadable day does not invent a contrast', () => {
    const ready = {
        yesterdayOk: true,
        yesterdayBody: historyBody('昨日の一句'),
        todayOk: true,
        todayBody: historyBody(undefined, 0),
        drawnNow: false
    };
    assert.equal(returnVisitSentence({...ready, yesterdayOk: false}), null);
    assert.equal(returnVisitSentence({...ready, todayOk: false}), null);
    assert.equal(returnVisitSentence({...ready, todayBody: {}}), null);
    assert.equal(returnVisitSentence({...ready, yesterdayBody: {items: [{sentence: 12}]}}), null);
    assert.equal(returnVisitSentence({...ready, drawnNow: true}), null);
});

test('loader reads yesterday and today history and keeps the sentence only when today is empty', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({url, credentials: init.credentials});
        if (String(url).includes('day=2026-10-29')) {
            return jsonResponse(historyBody('春の風'));
        }
        return jsonResponse(historyBody(undefined, 0));
    };
    const sentence = await loadReturnVisitSentence('2026-10-30', {fetchImpl});
    assert.equal(sentence, '春の風');
    assert.deepEqual(calls.map((call) => call.url), [
        '/api/history?day=2026-10-29&page=1&pageSize=1',
        '/api/history?day=2026-10-30&page=1&pageSize=1'
    ]);
    assert.deepEqual(calls.map((call) => call.credentials), ['include', 'include']);

    const yearBoundary = [];
    await loadReturnVisitSentence('2026-01-01', {
        fetchImpl: async (url) => {
            yearBoundary.push(String(url));
            return jsonResponse(historyBody(undefined, 0));
        }
    });
    assert.equal(yearBoundary[0], '/api/history?day=2025-12-31&page=1&pageSize=1');
});

test('loader stays quiet when today already has a card or the request fails', async () => {
    const drawn = await loadReturnVisitSentence('2026-10-30', {
        fetchImpl: async (url) => {
            if (String(url).includes('day=2026-10-29')) return jsonResponse(historyBody('春の風'));
            return jsonResponse(historyBody('今日', 2));
        }
    });
    assert.equal(drawn, null);

    const failed = await loadReturnVisitSentence('2026-10-30', {
        fetchImpl: async () => {
            throw new Error('offline');
        }
    });
    assert.equal(failed, null);

    const yesterdayDown = await loadReturnVisitSentence('2026-10-30', {
        fetchImpl: async (url) => jsonResponse(historyBody('春の風'), !String(url).includes('day=2026-10-29'))
    });
    assert.equal(yesterdayDown, null);
});

test('the brick is a short paper slip without vermilion, buttons, or the fox', () => {
    const css = fs.readFileSync(new URL('../src/styles/hiyori.css', import.meta.url), 'utf8');
    const start = css.indexOf('.return-visit {');
    const end = css.indexOf('/* /return-visit */');
    assert.ok(start >= 0 && end > start);
    const block = css.slice(start, end);
    assert.match(block, /height:\s*56px/);
    assert.match(block, /background:\s*var\(--card\)/);
    assert.match(block, /border:\s*1px solid var\(--paper-edge\)/);
    assert.match(block, /opacity:\s*\.72/);
    assert.match(block, /-webkit-line-clamp:\s*2/);
    assert.match(block, /return-visit-fade\s+240ms/);
    assert.doesNotMatch(block, /#C45C4A/i);
    assert.doesNotMatch(block, /var\(--accent\)/);
    const duration = Number(block.match(/return-visit-fade\s+(\d+)ms/)?.[1]);
    assert.ok(duration > 0 && duration < 280);

    const view = fs.readFileSync(new URL('../src/components/ReturnVisit.tsx', import.meta.url), 'utf8');
    const jsx = view.slice(view.indexOf('return ('));
    assert.match(view, /昨日一句/);
    assert.match(jsx, />昨日</);
    assert.doesNotMatch(jsx, /<button|SealFox|#C45C4A|补签/);

    const page = fs.readFileSync(new URL('../src/components/pages/ExplorePage.tsx', import.meta.url), 'utf8');
    assert.match(page, /visibleReturnVisit\(visitSentence, exploreState\)/);
    assert.match(page, /visitLine \? <ReturnVisit sentence=\{visitLine\} \/> : null/);
    assert.doesNotMatch(page, /SealFox|#C45C4A/);
});
