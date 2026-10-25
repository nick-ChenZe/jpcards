import {describe, expect, it} from 'vitest';
import {generationEstimate, readCardResponse} from '../../../../frontend/src/lib/cardProgress';
import {cardProgressStream} from '../cardProgress';

describe('card progress transport', () => {
    it('delivers real stages before completion and preserves a quota error in the result', async () => {
        let complete!: () => void;
        const finished = new Promise<void>(resolve => {
            complete = resolve;
        });
        const response = cardProgressStream(async report => {
            report('sentence');
            await finished;
            report('illustration');
            return {status: 429, body: {error: 'QUOTA_EXCEEDED'}};
        });
        const reader = response.body!.getReader();
        const first = await reader.read();
        expect(new TextDecoder().decode(first.value)).toContain('"stage":"sentence"');
        complete();
        reader.releaseLock();
        const stages: string[] = [];
        expect(await readCardResponse(response, stage => stages.push(stage))).toEqual({
            status: 429,
            body: {error: 'QUOTA_EXCEEDED'}
        });
        expect(stages).toEqual(['illustration']);
    });

    it('decodes Chinese and Japanese split across byte boundaries', async () => {
        const bytes = new TextEncoder().encode(
            `${JSON.stringify({type: 'result', status: 200, body: {sentence: '花が咲く。', gloss: '花开了。'}})}\n`
        );
        const response = new Response(
            new ReadableStream({
                start(c) {
                    for (const b of bytes) c.enqueue(new Uint8Array([b]));
                    c.close();
                }
            }),
            {headers: {'Content-Type': 'application/x-ndjson'}}
        );
        expect((await readCardResponse<{gloss: string;}>(response, () => {})).body?.gloss).toBe('花开了。');
    });

    it('reports truncated streams and never pretends an overdue request has finished', async () => {
        await expect(
            readCardResponse(
                new Response('{"type":"progress","stage":"sentence"}\n', {
                    headers: {'Content-Type': 'application/x-ndjson'}
                }),
                () => {}
            )
        ).rejects.toThrow('连接中断');
        expect(generationEstimate(90, 50, 'illustration')).toContain('比平时稍久');
        expect(generationEstimate(49, 50, 'illustration')).not.toMatch(/还需 0[– 秒]/);
        expect(generationEstimate(50, 50, 'finishing')).toContain('几秒');
    });
});
