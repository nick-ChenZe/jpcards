import type {Env} from '../types.js';
import {IMAGE_GENERATION_FAILED, IMAGE_UNAVAILABLE} from '../userCopy.js';
import {paceQwenImage, QWEN_PRO_MIN_INTERVAL_MS, QWEN_PRO_RPM} from './qwenQueue.js';
import type {ImageGenerationResult, ImageProvider, ImageRequest} from './types.js';

/**
 * 百炼 / DashScope 通义万相。
 * 正式模型是 qwen-image-3.0。qwen-image-2.1-turbo 只给预览，评测通过前不能当默认。
 * 3.0 与 2.1 都走同步多模态生成。发请求前先占 QwenImageLimiter，间隔仍按大约 20 RPM。
 * 北京地域与 qwen3-tts-flash 共用 dashscope.aliyuncs.com。不要改成异步 text2image。
 */
export const QWEN_IMAGE_MODEL = 'qwen-image-3.0';
export const QWEN_IMAGE_MODEL_TURBO = 'qwen-image-2.1-turbo';
export const QWEN_IMAGE_ENDPOINT =
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_IMAGE_SIZE = '1024*1024';
const MAX_PROMPT_CHARS = 4000;

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

/** 有百炼密钥才发送。没有密钥时 send 为 false，调用方不应等待或联网。 */
export function planQwenImageCall (env: Env): {
    model: string;
    tier: 'formal' | 'turbo';
    rpm: number;
    minIntervalMs: number;
    send: boolean;
} {
    const resolved = resolveQwenImageModel(env);
    return {
        model: resolved.model,
        tier: resolved.tier,
        rpm: QWEN_PRO_RPM,
        minIntervalMs: QWEN_PRO_MIN_INTERVAL_MS,
        send: dashScopeApiKey(env).length > 0
    };
}

interface DashScopeContent {
    image?: unknown;
}

interface DashScopeImageBody {
    code?: unknown;
    output?: {
        choices?: Array<{
            message?: {
                content?: DashScopeContent[];
            };
        }>;
    };
}

function clipPrompt (prompt: string): string {
    return Array.from(prompt.trim()).slice(0, MAX_PROMPT_CHARS).join('');
}

/** 只接受百炼结果图，或调用方已经拿到的 data:image。http 升成 https。 */
export function usableImageUrl (raw: string): string | null {
    const trimmed = raw.trim();
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) {
        return trimmed;
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }
    if (url.protocol === 'http:') {
        url.protocol = 'https:';
    }
    if (url.protocol !== 'https:') {
        return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'aliyuncs.com' && !host.endsWith('.aliyuncs.com')) {
        return null;
    }
    return url.toString();
}

function imageParameters (tier: 'formal' | 'turbo'): {
    prompt_extend: boolean;
    watermark: boolean;
    n: number;
    size: string;
    enable_thinking?: boolean;
} {
    const parameters = {
        // The art direction is complete; automatic rewriting can add glossy detail.
        prompt_extend: false,
        watermark: false,
        n: 1,
        size: QWEN_IMAGE_SIZE
    };
    if (tier === 'formal') {
        return {...parameters, enable_thinking: false};
    }
    return parameters;
}

function readImageUrl (body: DashScopeImageBody): string | null {
    for (const choice of body.output?.choices ?? []) {
        for (const item of choice.message?.content ?? []) {
            if (typeof item?.image !== 'string') {
                continue;
            }
            const usable = usableImageUrl(item.image);
            if (usable) {
                return usable;
            }
        }
    }
    return null;
}

function notConfigured (model: string): ImageGenerationResult {
    return {
        ok: false,
        code: 'IMAGE_NOT_CONFIGURED',
        provider: 'qwen',
        model,
        message: IMAGE_UNAVAILABLE
    };
}

function failed (model: string): ImageGenerationResult {
    return {
        ok: false,
        code: 'IMAGE_FAILED',
        provider: 'qwen',
        model,
        message: IMAGE_GENERATION_FAILED
    };
}

export const qwenImageProvider: ImageProvider = {
    id: 'qwen',
    model: QWEN_IMAGE_MODEL,
    isConfigured(env) {
        return dashScopeApiKey(env).length > 0;
    },
    async generate(input: ImageRequest, env: Env, fetchImpl: typeof fetch = fetch): Promise<ImageGenerationResult> {
        const plan = planQwenImageCall(env);
        if (!plan.send) {
            return notConfigured(plan.model);
        }

        const prompt = clipPrompt(input.prompt);
        if (!prompt) {
            return failed(plan.model);
        }

        const request = fetchImpl ?? fetch;
        try {
            await paceQwenImage();
            const response = await request(QWEN_IMAGE_ENDPOINT, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${dashScopeApiKey(env)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: plan.model,
                    input: {
                        messages: [
                            {
                                role: 'user',
                                content: [{text: prompt}]
                            }
                        ]
                    },
                    parameters: imageParameters(plan.tier)
                })
            });
            if (!response.ok) {
                console.error('Qwen image failed', response.status);
                return failed(plan.model);
            }

            const body = await response.json() as DashScopeImageBody;
            if (typeof body.code === 'string' && body.code.trim()) {
                console.error('Qwen image failed', body.code);
                return failed(plan.model);
            }
            const imageUrl = readImageUrl(body);
            if (!imageUrl) {
                console.error('Qwen image failed', response.status);
                return failed(plan.model);
            }
            return {
                ok: true,
                provider: 'qwen',
                model: plan.model,
                imageDataUrl: imageUrl,
                illustrationUrl: imageUrl
            };
        } catch (error) {
            console.error('Qwen image failed', error instanceof Error ? error.name : 'Error');
            return failed(plan.model);
        }
    }
};
