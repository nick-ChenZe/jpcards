import type {Env} from '../types.js';
import {IMAGE_UNAVAILABLE} from '../userCopy.js';
import {QWEN_PRO_MIN_INTERVAL_MS, QWEN_PRO_RPM} from './qwenQueue.js';
import type {ImageGenerationResult, ImageProvider, ImageRequest} from './types.js';

/**
 * 百炼 / DashScope 通义万相。
 * 正式模型是 qwen-image-3.0。qwen-image-2.1-turbo 只给预览，评测通过前不能当默认。
 * 3.0 不按高并发来。真正发请求之前必须先占 QwenImageLimiter，间隔仍按大约 20 RPM。
 * 当前 generate() 不发请求。
 */
export const QWEN_IMAGE_MODEL = 'qwen-image-3.0';
export const QWEN_IMAGE_MODEL_TURBO = 'qwen-image-2.1-turbo';

/** 只读传入的 Worker 绑定，调用方应传入 c.env。不要在源码里写密钥。 */
export function dashScopeApiKey (env: Env): string {
    return env.DASHSCOPE_API_KEY?.trim() || env.BAILIAN_API_KEY?.trim() || '';
}

export function resolveQwenImageModel (env: Env): {model: string; tier: 'formal' | 'turbo';} {
    const tier = env.QWEN_IMAGE_TIER?.trim().toLowerCase();
    if (tier === 'turbo' || tier === 'preview' || tier === 'draft') {
        return {model: QWEN_IMAGE_MODEL_TURBO, tier: 'turbo'};
    }
    return {model: QWEN_IMAGE_MODEL, tier: 'formal'};
}

/** 以后接入 HTTP 时用。现在 send 固定为 false，避免空转等待。 */
export function planQwenImageCall (env: Env): {
    model: string;
    tier: 'formal' | 'turbo';
    rpm: number;
    minIntervalMs: number;
    send: false;
} {
    const resolved = resolveQwenImageModel(env);
    return {
        model: resolved.model,
        tier: resolved.tier,
        rpm: QWEN_PRO_RPM,
        minIntervalMs: QWEN_PRO_MIN_INTERVAL_MS,
        send: false
    };
}

export const qwenImageProvider: ImageProvider = {
    id: 'qwen',
    model: QWEN_IMAGE_MODEL,
    isConfigured(env) {
        return dashScopeApiKey(env).length > 0;
    },
    async generate(_input: ImageRequest, env: Env): Promise<ImageGenerationResult> {
        const plan = planQwenImageCall(env);
        if (!dashScopeApiKey(env)) {
            return {
                ok: false,
                code: 'IMAGE_NOT_CONFIGURED',
                provider: 'qwen',
                model: plan.model,
                message: IMAGE_UNAVAILABLE
            };
        }

        return {
            ok: false,
            code: 'IMAGE_DISABLED',
            provider: 'qwen',
            model: plan.model,
            message: IMAGE_UNAVAILABLE
        };
    }
};
