import type {Env} from '../types.js';

export type ImageProviderId = 'noop' | 'qwen' | 'seedream' | 'openai';

export interface ImageRequest {
    prompt: string;
}

export type ImageGenerationResult =
    | {
        ok: true;
        provider: ImageProviderId;
        model: string;
        imageDataUrl: string;
        illustrationUrl: string | null;
    }
    | {
        ok: false;
        code: 'IMAGE_NOT_CONFIGURED' | 'IMAGE_DISABLED' | 'IMAGE_FAILED';
        provider: ImageProviderId;
        model: string | null;
        message: string;
    };

export interface ImageProvider {
    readonly id: ImageProviderId;
    readonly model: string | null;
    isConfigured(env: Env): boolean;
    generate(input: ImageRequest, env: Env, fetchImpl?: typeof fetch): Promise<ImageGenerationResult>;
}
