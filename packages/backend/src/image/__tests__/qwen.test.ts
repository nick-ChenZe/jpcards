import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {IMAGE_GENERATION_FAILED, IMAGE_UNAVAILABLE} from '../../userCopy.js';
import {planQwenImageCall, QWEN_IMAGE_ENDPOINT, qwenImageProvider, usableImageUrl} from '../qwen.js';
import {QwenImageLimiter, resetQwenImageLimiter} from '../qwenQueue.js';

const IMAGE_URL = 'https://dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com/card.png?Expires=1';

function imageResponse (image = IMAGE_URL, status = 200, extra: Record<string, unknown> = {}): Response {
    return new Response(
        JSON.stringify({
            ...extra,
            output: {
                choices: [{
                    finish_reason: 'stop',
                    message: {
                        role: 'assistant',
                        content: [{image}]
                    }
                }]
            }
        }),
        {status, headers: {'Content-Type': 'application/json'}}
    );
}

describe('qwen image generation', () => {
    beforeEach(() => {
        resetQwenImageLimiter();
    });

    it('plans a real send only when a Worker key is present', () => {
        expect(planQwenImageCall({} as Env).send).toBe(false);
        expect(planQwenImageCall({DASHSCOPE_API_KEY: 'dashscope-key'} as Env)).toMatchObject({
            model: 'qwen-image-3.0',
            tier: 'formal',
            rpm: 20,
            send: true
        });
        expect(
            planQwenImageCall({
                BAILIAN_API_KEY: 'alias',
                QWEN_IMAGE_TIER: 'preview'
            } as Env).model
        ).toBe('qwen-image-2.1-turbo');
        expect(
            planQwenImageCall({
                DASHSCOPE_API_KEY: 'dashscope-key',
                QWEN_IMAGE_TIER: 'draft'
            } as Env).model
        ).toBe('qwen-image-2.1-turbo');
    });

    it('does not fetch when the key is missing', async () => {
        const fetchImpl = vi.fn();
        const result = await qwenImageProvider.generate({prompt: 'a cat'}, {} as Env, fetchImpl);
        expect(result).toMatchObject({
            ok: false,
            code: 'IMAGE_NOT_CONFIGURED',
            message: IMAGE_UNAVAILABLE
        });
        expect(fetchImpl).not.toHaveBeenCalled();
        if (!result.ok) {
            expect(result.message).not.toMatch(/密钥|外部服务/);
        }
    });

    it('posts the sync DashScope body and returns a card image url', async () => {
        const fetchImpl = vi.fn(async () =>
            imageResponse(
                'http://dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com/card.png?Expires=1'
            )
        );
        const env = {DASHSCOPE_API_KEY: 'dashscope-key'} as Env;
        const result = await qwenImageProvider.generate({prompt: '  a quiet street  '}, env, fetchImpl);
        expect(result).toMatchObject({
            ok: true,
            provider: 'qwen',
            model: 'qwen-image-3.0',
            imageDataUrl: IMAGE_URL,
            illustrationUrl: IMAGE_URL
        });
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(QWEN_IMAGE_ENDPOINT);
        expect(init.method).toBe('POST');
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer dashscope-key');
        expect(new Headers(init.headers).get('X-DashScope-Async')).toBeNull();
        expect(JSON.parse(String(init.body))).toEqual({
            model: 'qwen-image-3.0',
            input: {
                messages: [{
                    role: 'user',
                    content: [{text: 'a quiet street'}]
                }]
            },
            parameters: {
                prompt_extend: true,
                watermark: false,
                n: 1,
                size: '1024*1024',
                enable_thinking: false
            }
        });
    });

    it('omits thinking mode on the turbo preview model', async () => {
        const fetchImpl = vi.fn(async () => imageResponse());
        await qwenImageProvider.generate({prompt: 'draft'}, {
            BAILIAN_API_KEY: 'alias-key',
            QWEN_IMAGE_TIER: 'turbo'
        } as Env, fetchImpl);
        const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
        expect(body.model).toBe('qwen-image-2.1-turbo');
        expect(body.parameters.enable_thinking).toBeUndefined();
        expect(new Headers((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers)
            .get('Authorization')).toBe('Bearer alias-key');
    });

    it('reserves the limiter before the request', async () => {
        const order: string[] = [];
        const plan = vi.spyOn(QwenImageLimiter.prototype, 'plan').mockImplementation((now = 0) => {
            order.push('plan');
            return {waitMs: 0, nextAt: now};
        });
        const fetchImpl = vi.fn(async () => {
            order.push('fetch');
            return imageResponse();
        });
        try {
            await qwenImageProvider.generate({prompt: 'a cat'}, {DASHSCOPE_API_KEY: 'dashscope-key'} as Env, fetchImpl);
            expect(order).toEqual(['plan', 'fetch']);
        } finally {
            plan.mockRestore();
        }
    });

    it('returns Chinese copy and does not throw when the vendor fails', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const cases = [
            async () =>
                new Response(
                    JSON.stringify({
                        code: 'InvalidApiKey',
                        message: 'Invalid API-key provided.'
                    }),
                    {status: 200, headers: {'Content-Type': 'application/json'}}
                ),
            async () => new Response('no', {status: 500}),
            async () => imageResponse('https://evil.example/card.png'),
            async () => {
                throw new Error('socket');
            }
        ];
        try {
            for (const fetchImpl of cases) {
                resetQwenImageLimiter();
                const result = await qwenImageProvider.generate(
                    {prompt: 'a cat'},
                    {DASHSCOPE_API_KEY: 'dashscope-key'} as Env,
                    vi.fn(fetchImpl)
                );
                expect(result).toMatchObject({
                    ok: false,
                    code: 'IMAGE_FAILED',
                    provider: 'qwen',
                    model: 'qwen-image-3.0',
                    message: IMAGE_GENERATION_FAILED
                });
                if (!result.ok) {
                    expect(result.message).not.toMatch(/密钥|外部服务|未配置/);
                }
            }
            expect(errors.mock.calls.flat().join(' ')).not.toContain('dashscope-key');
        } finally {
            errors.mockRestore();
        }
    });

    it('does not fetch an empty prompt', async () => {
        const fetchImpl = vi.fn();
        const result = await qwenImageProvider.generate(
            {prompt: '   '},
            {DASHSCOPE_API_KEY: 'dashscope-key'} as Env,
            fetchImpl
        );
        expect(result).toMatchObject({ok: false, code: 'IMAGE_FAILED', message: IMAGE_GENERATION_FAILED});
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('accepts a raster data url and rejects other hosts', () => {
        const dataUrl = 'data:image/png;base64,aaaa';
        expect(usableImageUrl(dataUrl)).toBe(dataUrl);
        expect(usableImageUrl('https://example.com/a.png')).toBeNull();
        expect(usableImageUrl('javascript:alert(1)')).toBeNull();
    });
});
