import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {playableAudioUrl, synthesizeSpeech, TTS_OUTBOUND_ENABLED} from '../qwen.js';

const audioResponse = (url: string, status = 200) =>
    new Response(JSON.stringify({output: {audio: {url}}}), {
        status,
        headers: {'Content-Type': 'application/json'}
    });

describe('qwen3-tts-flash', () => {
    it('does not call the vendor without a Bailian key', async () => {
        const fetchImpl = vi.fn();
        const previous = process.env.DASHSCOPE_API_KEY;
        process.env.DASHSCOPE_API_KEY = 'process-env-must-not-be-used';
        try {
            const result = await synthesizeSpeech(
                {
                    MINIMAX_API_KEY: 'minimax',
                    VOLC_API_AK: 'ak'
                } as unknown as Env,
                'こんにちは。',
                fetchImpl
            );
            expect(result).toMatchObject({ok: false, code: 'TTS_NOT_CONFIGURED', audioDataUrl: ''});
            expect(fetchImpl).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.DASHSCOPE_API_KEY;
            } else {
                process.env.DASHSCOPE_API_KEY = previous;
            }
        }
    });

    it('does not call DashScope when a Bailian key is set', async () => {
        const fetchImpl = vi.fn(async () =>
            audioResponse('http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.wav?Expires=9&Signature=sig')
        );
        const result = await synthesizeSpeech(
            {BAILIAN_API_KEY: 'worker-binding-only'} as Env,
            'こんにちは。',
            fetchImpl
        );
        expect(TTS_OUTBOUND_ENABLED).toBe(false);
        expect(result).toMatchObject({
            ok: false,
            code: 'TTS_NOT_CONFIGURED',
            audioDataUrl: '',
            audioUrl: null,
            message: '语音暂未开通'
        });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('does not call DashScope when DASHSCOPE_API_KEY is set', async () => {
        const fetchImpl = vi.fn(async () => new Response('no', {status: 500}));
        const result = await synthesizeSpeech({DASHSCOPE_API_KEY: 'dashscope-key'} as Env, 'こんにちは。', fetchImpl);
        expect(result.code).toBe('TTS_NOT_CONFIGURED');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('rejects non-audio hosts', () => {
        expect(playableAudioUrl('javascript:alert(1)')).toBeNull();
        expect(playableAudioUrl('https://example.com/a.wav')).toBeNull();
    });

    it('does not read node env or other vendors from the source', () => {
        const source = readFileSync(new URL('../qwen.ts', import.meta.url), 'utf8');
        expect(source).not.toMatch(/process\.env/);
        expect(source).not.toMatch(/minimax|volcengine|MINIMAX|VOLC_/i);
        expect(source).toContain('qwen3-tts-flash');
        expect(source).toContain('Japanese');
    });
});
