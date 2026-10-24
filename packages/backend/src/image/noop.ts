import type {Env} from '../types.js';
import type {ImageGenerationResult, ImageProvider, ImageRequest} from './types.js';

export const noopImageProvider: ImageProvider = {
    id: 'noop',
    model: null,
    isConfigured() {
        return false;
    },
    async generate(_input: ImageRequest, _env: Env): Promise<ImageGenerationResult> {
        return {
            ok: false,
            code: 'IMAGE_NOT_CONFIGURED',
            provider: 'noop',
            model: null,
            message: '配图未配置'
        };
    }
};
