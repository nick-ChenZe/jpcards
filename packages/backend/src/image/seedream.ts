import type {Env} from '../types.js';
import type {ImageGenerationResult, ImageProvider, ImageRequest} from './types.js';

/** Seedream 备选。当前版本只接线，不发请求。 */
export const SEEDREAM_IMAGE_MODEL = '5.0-flash';

export function seedreamApiKey (env: Env): string {
    return env.SEEDREAM_API_KEY?.trim() ?? '';
}

export const seedreamImageProvider: ImageProvider = {
    id: 'seedream',
    model: SEEDREAM_IMAGE_MODEL,
    isConfigured(env) {
        return seedreamApiKey(env).length > 0;
    },
    async generate(_input: ImageRequest, env: Env): Promise<ImageGenerationResult> {
        if (!seedreamApiKey(env)) {
            return {
                ok: false,
                code: 'IMAGE_NOT_CONFIGURED',
                provider: 'seedream',
                model: SEEDREAM_IMAGE_MODEL,
                message: '配图未配置'
            };
        }

        return {
            ok: false,
            code: 'IMAGE_DISABLED',
            provider: 'seedream',
            model: SEEDREAM_IMAGE_MODEL,
            message: 'Seedream 尚未接入，本次不会请求生图。'
        };
    }
};
