import type {Env} from '../types.js';
import {noopImageProvider} from './noop.js';
import {openAIImageProvider} from './openai.js';
import {qwenImageProvider} from './qwen.js';
import {seedreamImageProvider} from './seedream.js';
import type {ImageProvider} from './types.js';

export {noopImageProvider} from './noop.js';
export {openAIImageProvider} from './openai.js';
export {QWEN_IMAGE_MODEL, QWEN_IMAGE_MODEL_TURBO, qwenImageProvider, resolveQwenImageModel} from './qwen.js';
export {QWEN_PRO_MIN_INTERVAL_MS, QWEN_PRO_RPM} from './qwenQueue.js';
export {SEEDREAM_IMAGE_MODEL, seedreamImageProvider} from './seedream.js';
export type {ImageGenerationResult, ImageProvider, ImageProviderId, ImageRequest} from './types.js';

/**
 * 生产默认是 noop。
 * 只有百炼密钥（DASHSCOPE_API_KEY 或 BAILIAN_API_KEY）会在未指定时启用通义，正式模型是 qwen-image-3.0。
 * Seedream 和 OpenAI 必须显式选择，不会因为自己的密钥变成默认。
 */
export function createImageProvider (env: Env): ImageProvider {
    const choice = env.IMAGE_PROVIDER?.trim().toLowerCase();

    if (choice === 'noop') {
        return noopImageProvider;
    }
    if (choice === 'seedream') {
        return seedreamImageProvider.isConfigured(env) ? seedreamImageProvider : noopImageProvider;
    }
    if (choice === 'openai') {
        return openAIImageProvider.isConfigured(env) ? openAIImageProvider : noopImageProvider;
    }
    if (choice === 'qwen' || choice === undefined || choice === '') {
        return qwenImageProvider.isConfigured(env) ? qwenImageProvider : noopImageProvider;
    }
    return noopImageProvider;
}
