import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedSentenceHtml} from '../src/lib/sharedCardText.ts';

test('shared card sentence is escaped even when its text contains HTML or entities', () => {
    assert.equal(
        sharedSentenceHtml('<img src=x onerror="alert(1)"> &amp; \'日札\''),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;amp; &#39;日札&#39;'
    );
    assert.equal(sharedSentenceHtml('今日もいい天気ですね。'), '今日もいい天気ですね。');
});
