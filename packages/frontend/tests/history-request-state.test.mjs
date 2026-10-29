import test from 'node:test';
import assert from 'node:assert/strict';
import {historyRequestState} from '../src/lib/historyRequestState.ts';

test('date and page transitions show loading until the correct response is ready', () => {
    const firstPage = {day: '2026-10-29', page: 1, items: ['first']};
    assert.deepEqual(historyRequestState('2026-10-29', 1, null, null, false), {data: null, error: '', loading: true});
    assert.deepEqual(historyRequestState('2026-10-29', 2, firstPage, null, false), {data: null, error: '', loading: true});
    assert.deepEqual(historyRequestState('2026-10-30', 1, firstPage, {key: '2026-10-29:1', message: 'error'}, false), {data: null, error: '', loading: true});
    assert.deepEqual(historyRequestState('2026-10-29', 1, firstPage, null, false), {data: firstPage, error: '', loading: false});
});

test('an error only belongs to the requested page and a retry shows loading', () => {
    const error = {key: '2026-10-29:1', message: '重试'};
    assert.deepEqual(historyRequestState('2026-10-29', 1, null, error, false), {data: null, error: '重试', loading: false});
    assert.deepEqual(historyRequestState('2026-10-29', 1, null, error, true), {data: null, error: '重试', loading: true});
});
