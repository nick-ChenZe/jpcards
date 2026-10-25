import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';

const hoisted = vi.hoisted(() => {
    const constructed: Array<{apiKey?: string; baseURL?: string; fetch?: typeof fetch;}> = [];
    const create = vi.fn(async () => ({
        choices: [{message: {content: 'こんにちは。'}}]
    }));
    class OpenAI {
        chat = {completions: {create}};
        constructor(options: {apiKey?: string; baseURL?: string; fetch?: typeof fetch;}) {
            constructed.push(options);
        }
    }
    return {constructed, create, OpenAI};
});

const memory = vi.hoisted(() => ({
    getRecentSentences: vi.fn(async () => [] as string[]),
    insertSentence: vi.fn(async () => undefined)
}));

const history = vi.hoisted(() => ({
    insertCardHistory: vi.fn(async () => 'card-1'),
    updateCardAudio: vi.fn(async () => undefined)
}));

vi.mock('openai', () => ({default: hoisted.OpenAI}));
vi.mock('../../database/sentenceMemory.js', () => memory);
vi.mock('../../database/cardHistory.js', () => history);
vi.mock('../../utils/romaji.js', () => ({
    toSentenceWithKanjiRomaji: vi.fn(async (sentence: string) => sentence),
    toDisplayReading: vi.fn(async () => 'konnichiwa')
}));

import {buildCardWithMemory} from '../card.js';

describe('buildCardWithMemory vendor gate', () => {
    beforeEach(() => {
        hoisted.constructed.length = 0;
        hoisted.create.mockClear();
        memory.getRecentSentences.mockClear();
        memory.insertSentence.mockClear();
        history.insertCardHistory.mockClear();
        history.updateCardAudio.mockClear();
    });

    it('saves a local practice card and does not call vendors when the text model is missing', async () => {
        const fetchImpl = vi.fn();
        const result = await buildCardWithMemory({
            db: {} as never,
            userId: 'user-1',
            env: {
                VOLC_API_AK: 'ak',
                VOLC_API_SK: 'sk',
                MINIMAX_API_KEY: 'minimax'
            } as unknown as Env,
            fetchImpl
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.card.sentence).toBe('こんにちは。');
            expect(result.card.gloss).toBe('你好。');
            expect(result.card.reading).toBe('konnichiwa');
            expect(result.card.text.source).toBe('local');
            expect(result.card.text.configured).toBe(false);
            expect(result.card.text.message).not.toMatch(/密钥|外部服务/);
            expect(result.card.image.ok).toBe(false);
            if (!result.card.image.ok) {
                expect(result.card.image.message).toBe('配图暂未开通');
            }
            expect(result.card.audio.message).toBe('语音暂未开通');
            expect(result.card.imageDataUrl).toBe('');
            expect(result.card.audioDataUrl).toBe('');
            expect(result.card.image.ok).toBe(false);
            if (!result.card.image.ok) {
                expect(result.card.image.code).toBe('IMAGE_NOT_CONFIGURED');
                expect(result.card.image.provider).toBe('noop');
            }
            expect(result.card.audio.code).toBe('TTS_NOT_CONFIGURED');
        }
        expect(hoisted.constructed).toHaveLength(0);
        expect(hoisted.create).not.toHaveBeenCalled();
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(history.updateCardAudio).not.toHaveBeenCalled();
        expect(memory.insertSentence).toHaveBeenCalledOnce();
        expect(history.insertCardHistory).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                userId: 'user-1',
                sentence: 'こんにちは。',
                gloss: '你好。',
                reading: 'konnichiwa'
            })
        );
    });

    it('keeps the text card and stores qwen tts audio when the Bailian key is set', async () => {
        const fetchImpl = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    output: {
                        audio: {
                            url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/card.wav?Expires=1&Signature=test'
                        }
                    }
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}}
            )
        );
        const result = await buildCardWithMemory({
            db: {} as never,
            userId: 'user-1',
            env: {
                CHAT_API_KEY: 'chat-key',
                CHAT_API_ENDPOINT: 'https://api.deepseek.com/v1',
                DASHSCOPE_API_KEY: 'dashscope-key',
                VOLC_API_AK: 'ak',
                MINIMAX_API_KEY: 'minimax'
            } as unknown as Env,
            fetchImpl
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.card.sentence).toBe('こんにちは。');
            expect(result.card.gloss).toBe('');
            expect(result.card.text.source).toBe('model');
            expect(result.card.id).toBe('card-1');
            expect(result.card.imageDataUrl).toBe('');
            expect(result.card.audioDataUrl).toBe(
                'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/card.wav?Expires=1&Signature=test'
            );
            expect(result.card.image.ok).toBe(false);
            if (!result.card.image.ok) {
                expect(result.card.image.provider).toBe('qwen');
                expect(result.card.image.model).toBe('qwen-image-3.0');
                expect(result.card.image.code).toBe('IMAGE_DISABLED');
            }
            expect(result.card.audio.ok).toBe(true);
            if (result.card.audio.ok) {
                expect(result.card.audio.model).toBe('qwen3-tts-flash');
            }
        }
        expect(history.insertCardHistory).toHaveBeenCalledOnce();
        expect(history.updateCardAudio).toHaveBeenCalledWith(
            expect.anything(),
            'card-1',
            'user-1',
            'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/card.wav?Expires=1&Signature=test'
        );
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [ttsUrl, ttsInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(ttsUrl).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
        expect(new Headers(ttsInit.headers).get('Authorization')).toBe('Bearer dashscope-key');
        expect(JSON.parse(String(ttsInit.body))).toEqual({
            model: 'qwen3-tts-flash',
            input: {
                text: 'こんにちは。',
                voice: 'Cherry',
                language_type: 'Japanese'
            }
        });

        const chatFetch = hoisted.constructed[0]?.fetch;
        expect(chatFetch).toBeTypeOf('function');
        await expect(chatFetch?.('https://api.minimax.chat/v1/t2a_v2')).rejects.toThrow('Blocked outbound request');
        await expect(chatFetch?.('https://visual.volcengineapi.com/')).rejects.toThrow('Blocked outbound request');
        await expect(chatFetch?.('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis'))
            .rejects.toThrow('Blocked outbound request');
    });
});
