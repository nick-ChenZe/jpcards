import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {AUDIO_GENERATION_FAILED, AUDIO_UNAVAILABLE} from '../../userCopy.js';
import {playableAudioUrl, synthesizeSpeech} from '../qwen.js';

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
            expect(result).toMatchObject({
                ok: false,
                code: 'TTS_NOT_CONFIGURED',
                audioDataUrl: '',
                audioUrl: null,
                message: AUDIO_UNAVAILABLE
            });
            expect(fetchImpl).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.DASHSCOPE_API_KEY;
            } else {
                process.env.DASHSCOPE_API_KEY = previous;
            }
        }
    });

    it('posts Japanese qwen3-tts-flash when only the Bailian alias is set', async () => {
        const fetchImpl = vi.fn(async () =>
            audioResponse('http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.wav?Expires=9&Signature=sig')
        );
        const result = await synthesizeSpeech(
            {BAILIAN_API_KEY: 'worker-binding-only'} as Env,
            'こんにちは。',
            fetchImpl
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.model).toBe('qwen3-tts-flash');
            expect(result.audioUrl).toBe(
                'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.wav?Expires=9&Signature=sig'
            );
            expect(result.audioDataUrl).toBe(result.audioUrl);
        }
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer worker-binding-only');
        expect(JSON.parse(String(init.body))).toEqual({
            model: 'qwen3-tts-flash',
            input: {
                text: 'こんにちは。',
                voice: 'Cherry',
                language_type: 'Japanese'
            }
        });
    });

    it('returns TTS_FAILED and does not throw when the vendor URL is not DashScope audio', async () => {
        const fetchImpl = vi.fn(async () => audioResponse('https://evil.example/a.wav'));
        const result = await synthesizeSpeech({DASHSCOPE_API_KEY: 'dashscope-key'} as Env, 'こんにちは。', fetchImpl);
        expect(result).toMatchObject({
            ok: false,
            code: 'TTS_FAILED',
            audioUrl: null,
            message: AUDIO_GENERATION_FAILED
        });
    });

    it('returns TTS_FAILED when the request fails', async () => {
        const fetchImpl = vi.fn(async () => new Response('no', {status: 500}));
        const result = await synthesizeSpeech({DASHSCOPE_API_KEY: 'dashscope-key'} as Env, 'こんにちは。', fetchImpl);
        expect(result).toMatchObject({ok: false, code: 'TTS_FAILED', audioUrl: null, message: AUDIO_GENERATION_FAILED});
    });

    it('returns TTS_FAILED when DashScope returns an error code', async () => {
        const fetchImpl = vi.fn(async () =>
            new Response(JSON.stringify({code: 'InvalidParameter', message: 'bad text'}), {
                status: 200,
                headers: {'Content-Type': 'application/json'}
            })
        );
        const result = await synthesizeSpeech({DASHSCOPE_API_KEY: 'dashscope-key'} as Env, 'こんにちは。', fetchImpl);
        expect(result).toMatchObject({ok: false, code: 'TTS_FAILED', audioUrl: null});
    });

    it('returns TTS_FAILED when the request throws', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('network down');
        });
        const result = await synthesizeSpeech({DASHSCOPE_API_KEY: 'dashscope-key'} as Env, 'こんにちは。', fetchImpl);
        expect(result).toMatchObject({ok: false, code: 'TTS_FAILED', audioUrl: null, message: AUDIO_GENERATION_FAILED});
    });

    it('rejects non-audio hosts', () => {
        expect(playableAudioUrl('javascript:alert(1)')).toBeNull();
        expect(playableAudioUrl('https://example.com/a.wav')).toBeNull();
    });

    it('does not read node env or other vendors from the source', () => {
        const source = readFileSync(new URL('../qwen.ts', import.meta.url), 'utf8');
        expect(source).not.toMatch(/process\.env/);
        expect(source).not.toMatch(/minimax|volcengine|MINIMAX|VOLC_/i);
        expect(source).not.toContain('TTS_OUTBOUND_ENABLED');
        expect(source).toContain('qwen3-tts-flash');
        expect(source).toContain('Japanese');
    });
});
