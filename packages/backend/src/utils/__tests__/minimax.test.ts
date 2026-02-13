import {describe, expect, it} from 'vitest';
import {config} from '../../config/index.js';
import {synthesizeTextToAudioHex} from '../minimax.js';

const hasRealMinimaxConfig = Boolean(config.env.minimaxApiKey);

describe('Minimax real integration', () => {
    it.runIf(hasRealMinimaxConfig)(
        'calls minimax /v1/t2a_v2 with local dotenv config',
        async () => {
            const result = await synthesizeTextToAudioHex({
                text: 'こんにちは、これは接入测试です。',
                format: 'mp3',
                speed: 1.0
            });

            expect(result.audioHex.length).toBeGreaterThan(0);
            expect(result.audioHex.length % 2).toBe(0);
            expect(result.audioFormat).toBeTypeOf('string');
            expect(result.sizeBytes).toBeGreaterThan(0);
            expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
        },
        30000
    );
});
