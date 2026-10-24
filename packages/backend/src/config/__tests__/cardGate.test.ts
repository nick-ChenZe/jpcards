import {describe, expect, it, vi} from 'vitest';
import type {Env} from '../../types.js';
import {assessCardGeneration, createChatFetch} from '../index.js';

describe('assessCardGeneration', () => {
    it('disables card generation when the text model is missing', () => {
        expect(assessCardGeneration({} as Env)).toEqual({enabled: false, code: 'CARD_GEN_DISABLED'});
        expect(assessCardGeneration({CHAT_API_KEY: 'key'} as Env).enabled).toBe(false);
        expect(
            assessCardGeneration({
                CHAT_API_KEY: 'key',
                CHAT_API_ENDPOINT: 'https://api.minimax.chat/v1'
            } as Env).enabled
        ).toBe(false);
        expect(
            assessCardGeneration({
                CHAT_API_KEY: 'key',
                CHAT_API_ENDPOINT: 'https://visual.volcengineapi.com'
            } as Env).enabled
        ).toBe(false);
    });

    it('allows a configured text endpoint that is not an image or TTS host', () => {
        const gate = assessCardGeneration({
            CHAT_API_KEY: 'key',
            CHAT_API_ENDPOINT: 'https://api.deepseek.com/v1',
            CHAT_MODEL: 'deepseek-chat'
        } as Env);
        expect(gate).toEqual({
            enabled: true,
            text: {
                chatApiKey: 'key',
                chatApiEndpoint: 'https://api.deepseek.com/v1',
                chatModel: 'deepseek-chat'
            }
        });
    });
});

describe('createChatFetch', () => {
    it('blocks Volcengine and MiniMax even if a caller asks for them', async () => {
        const inner = vi.fn(async () => new Response('ok'));
        const chatFetch = createChatFetch('https://api.deepseek.com/v1', inner);

        await expect(chatFetch('https://api.minimax.chat/v1/t2a_v2')).rejects.toThrow('Blocked outbound request');
        await expect(chatFetch('https://visual.volcengineapi.com/?Action=CVSync2AsyncSubmitTask'))
            .rejects.toThrow('Blocked outbound request');
        await expect(chatFetch('https://example.com/v1/chat/completions')).rejects.toThrow('Blocked outbound request');
        expect(inner).not.toHaveBeenCalled();

        await chatFetch('https://api.deepseek.com/chat/completions');
        expect(inner).toHaveBeenCalledOnce();
    });
});
