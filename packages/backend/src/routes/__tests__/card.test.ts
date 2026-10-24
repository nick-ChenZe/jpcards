import {describe, expect, it} from 'vitest';
import {readNodeEnv} from '../../config/nodeEnv.js';
import type {Env} from '../../types.js';
import {buildCardDemo} from '../card.js';

const nodeEnv = readNodeEnv();
const hasRealCardDemoConfig = Boolean(nodeEnv.chatApiKey && nodeEnv.chatApiEndpoint);

describe('Card demo real integration', () => {
    it.runIf(hasRealCardDemoConfig)(
        'builds sentence, image and audio with local dotenv config',
        async () => {
            const result = await buildCardDemo({
                CHAT_API_KEY: nodeEnv.chatApiKey,
                CHAT_API_ENDPOINT: nodeEnv.chatApiEndpoint
            } as Env);

            expect(result.sentence.trim().length).toBeGreaterThan(0);
            expect(result.sentenceHtml.length).toBeGreaterThan(0);
            expect(result.imageDataUrl).toBe('');
            expect(result.audioDataUrl).toBe('');
            expect(result.image.ok).toBe(false);
            expect(result.audio.code).toBe('TTS_NOT_CONFIGURED');
        },
        120000
    );
});
