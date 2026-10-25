import type {Env} from '../types.js';
import {IMAGE_UNAVAILABLE} from '../userCopy.js';
import type {ImageGenerationResult, ImageProvider, ImageRequest} from './types.js';

/**
 * 可选的高级配图，以后才接 OpenAI GPT Image。
 * 只认 OPENAI_API_KEY。不要读取 Codex 或 ChatGPT 的登录态。
 */
export function openAIApiKey (env: Env): string {
    return env.OPENAI_API_KEY?.trim() ?? '';
}

export const openAIImageProvider: ImageProvider = {
    id: 'openai',
    model: null,
    isConfigured(env) {
        return openAIApiKey(env).length > 0;
    },
    async generate(_input: ImageRequest, env: Env): Promise<ImageGenerationResult> {
        if (!openAIApiKey(env)) {
            return {
                ok: false,
                code: 'IMAGE_NOT_CONFIGURED',
                provider: 'openai',
                model: null,
                message: IMAGE_UNAVAILABLE
            };
        }

        return {
            ok: false,
            code: 'IMAGE_DISABLED',
            provider: 'openai',
            model: null,
            message: IMAGE_UNAVAILABLE
        };
    }
};
