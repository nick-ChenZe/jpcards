import {readFileSync} from 'node:fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {createImageProvider, openAIImageProvider, qwenImageProvider, seedreamImageProvider} from '../provider.js';
import {resetQwenImageLimiter} from '../qwenQueue.js';

const imageDir = new URL('..', import.meta.url);

function sourceOf (name: string): string {
    return readFileSync(new URL(name, imageDir), 'utf8');
}

async function expectNoFetch (run: () => Promise<unknown>) {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network is forbidden'));
    try {
        await run();
        expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
        fetchSpy.mockRestore();
    }
}

function imageResponse (): Response {
    return new Response(
        JSON.stringify({
            output: {
                choices: [{
                    message: {
                        content: [{
                            image: 'https://dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com/card.png?Expires=1'
                        }]
                    }
                }]
            }
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
    );
}

describe('createImageProvider', () => {
    beforeEach(() => {
        resetQwenImageLimiter();
    });

    it('defaults to noop when no image key is set', () => {
        expect(createImageProvider({} as Env).id).toBe('noop');
    });

    it('does not treat an OpenAI key or OAuth-like values as a configured provider', () => {
        const env = {
            OPENAI_API_KEY: 'openai-test-value',
            OPENAI_OAUTH_TOKEN: 'oauth-token',
            CHATGPT_OAUTH: 'session'
        } as unknown as Env;
        expect(createImageProvider(env).id).toBe('noop');
    });

    it('reads Bailian keys only from Worker env, not process.env', async () => {
        const previousDashScope = process.env.DASHSCOPE_API_KEY;
        const previousBailian = process.env.BAILIAN_API_KEY;
        process.env.DASHSCOPE_API_KEY = 'process-env-must-not-be-used';
        process.env.BAILIAN_API_KEY = 'process-env-must-not-be-used';
        try {
            expect(createImageProvider({} as Env).id).toBe('noop');
            const fromAlias = {BAILIAN_API_KEY: 'worker-binding-only'} as Env;
            const provider = createImageProvider(fromAlias);
            expect(provider.id).toBe('qwen');
            expect(provider.model).toBe('qwen-image-3.0');
            const fetchImpl = vi.fn(async () => imageResponse());
            const result = await provider.generate({prompt: 'name card'}, fromAlias, fetchImpl);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.model).toBe('qwen-image-3.0');
            }
            const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
            expect(new Headers(init.headers).get('Authorization')).toBe('Bearer worker-binding-only');
            expect(String(init.body)).not.toContain('process-env-must-not-be-used');
        } finally {
            if (previousDashScope === undefined) {
                delete process.env.DASHSCOPE_API_KEY;
            } else {
                process.env.DASHSCOPE_API_KEY = previousDashScope;
            }
            if (previousBailian === undefined) {
                delete process.env.BAILIAN_API_KEY;
            } else {
                process.env.BAILIAN_API_KEY = previousBailian;
            }
        }
    });

    it('uses Qwen qwen-image-3.0 when a Bailian key is present', async () => {
        const env = {DASHSCOPE_API_KEY: 'dashscope-key'} as Env;
        const provider = createImageProvider(env);
        expect(provider.id).toBe('qwen');
        expect(provider.model).toBe('qwen-image-3.0');
        const fetchImpl = vi.fn(async () => imageResponse());
        const result = await provider.generate({prompt: 'name card'}, env, fetchImpl);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.model).toBe('qwen-image-3.0');
            expect(result.imageDataUrl).toContain('aliyuncs.com');
        }
        const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
        expect(body.model).toBe('qwen-image-3.0');
    });

    it('keeps turbo as an explicit preview and never the default', async () => {
        const preview = {DASHSCOPE_API_KEY: 'dashscope-key', QWEN_IMAGE_TIER: 'turbo'} as Env;
        expect(createImageProvider(preview).model).toBe('qwen-image-3.0');
        const previewFetch = vi.fn(async () => imageResponse());
        const result = await createImageProvider(preview).generate({prompt: 'name card'}, preview, previewFetch);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.model).toBe('qwen-image-2.1-turbo');
        }
        expect(JSON.parse(String((previewFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).model)
            .toBe('qwen-image-2.1-turbo');

        resetQwenImageLimiter();
        const unset = {DASHSCOPE_API_KEY: 'dashscope-key', QWEN_IMAGE_TIER: ''} as Env;
        const formalFetch = vi.fn(async () => imageResponse());
        const formal = await createImageProvider(unset).generate({prompt: 'name card'}, unset, formalFetch);
        expect(formal.ok).toBe(true);
        if (formal.ok) {
            expect(formal.model).toBe('qwen-image-3.0');
        }
    });

    it('does not make Seedream or OpenAI the default just because their keys exist', () => {
        expect(createImageProvider({SEEDREAM_API_KEY: 'seedream-key'} as Env).id).toBe('noop');
        expect(
            createImageProvider({
                SEEDREAM_API_KEY: 'seedream-key',
                OPENAI_API_KEY: 'openai-test-value'
            } as Env).id
        ).toBe('noop');
    });

    it('keeps Qwen ahead of a Seedream key when Bailian is configured', () => {
        const provider = createImageProvider({
            DASHSCOPE_API_KEY: 'dashscope-key',
            SEEDREAM_API_KEY: 'seedream-key'
        } as Env);
        expect(provider.id).toBe('qwen');
        expect(provider.model).toBe('qwen-image-3.0');
    });

    it('honors an explicit provider only when its key exists', () => {
        expect(
            createImageProvider({
                IMAGE_PROVIDER: 'seedream',
                DASHSCOPE_API_KEY: 'dashscope-key',
                SEEDREAM_API_KEY: 'seedream-key'
            } as Env).id
        ).toBe('seedream');

        expect(
            createImageProvider({
                IMAGE_PROVIDER: 'qwen'
            } as Env).id
        ).toBe('noop');

        expect(
            createImageProvider({
                IMAGE_PROVIDER: 'openai',
                OPENAI_API_KEY: 'openai-test-value'
            } as Env).id
        ).toBe('openai');

        expect(
            createImageProvider({
                IMAGE_PROVIDER: 'noop',
                DASHSCOPE_API_KEY: 'dashscope-key'
            } as Env).id
        ).toBe('noop');
    });

    it('does not call the network for noop, Seedream, or OpenAI', async () => {
        const cases = [
            createImageProvider({} as Env),
            seedreamImageProvider,
            openAIImageProvider
        ];
        for (const provider of cases) {
            await expectNoFetch(async () => {
                const result = await provider.generate({prompt: 'a cat'}, {
                    DASHSCOPE_API_KEY: 'dashscope-key',
                    SEEDREAM_API_KEY: 'seedream-key',
                    OPENAI_API_KEY: 'openai-test-value',
                    VOLC_API_AK: 'ak',
                    VOLC_API_SK: 'sk'
                } as unknown as Env);
                expect(result.ok).toBe(false);
            });
        }
    });

    it('does not call the network for Qwen when no Bailian key is set', async () => {
        const fetchImpl = vi.fn();
        const result = await qwenImageProvider.generate({prompt: 'a cat'}, {} as Env, fetchImpl);
        expect(result.ok).toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('reports not configured when the selected stub has no key', async () => {
        const result = await qwenImageProvider.generate({prompt: 'a cat'}, {} as Env);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('IMAGE_NOT_CONFIGURED');
            expect(result.message).toBe('配图暂未开通');
        }
    });

    it('does not contain OAuth env names or process.env', () => {
        const banned = ['CODEX_TOKEN', 'CHATGPT_OAUTH', 'OPENAI_OAUTH'];
        for (const name of ['noop.ts', 'qwen.ts', 'seedream.ts', 'openai.ts', 'provider.ts']) {
            const source = sourceOf(name);
            expect(source).not.toMatch(/process\.env/);
            for (const token of banned) {
                expect(source.includes(token)).toBe(false);
            }
            if (name !== 'qwen.ts') {
                expect(source).not.toMatch(/\bfetch\s*\(/);
            }
        }
        const qwen = sourceOf('qwen.ts');
        expect(qwen).toContain(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
        );
        expect(qwen).toContain('paceQwenImage');
        expect(qwen).not.toContain('send: false');
    });
});
