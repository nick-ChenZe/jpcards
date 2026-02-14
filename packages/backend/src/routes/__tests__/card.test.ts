import {describe, expect, it} from 'vitest';
import {config} from '../../config/index.js';
import {buildCardDemo} from '../card.js';

const hasRealCardDemoConfig = Boolean(
    config.env.chatApiKey
        && config.env.chatApiEndpoint
        && config.env.volcApiAk
        && config.env.volcApiSk
        && config.env.minimaxApiKey
        && config.env.minimaxEndpoint
        && config.env.minimaxModel
        && config.env.minimaxVoiceId
);

describe('Card demo real integration', () => {
    it.runIf(hasRealCardDemoConfig)(
        'builds sentence, image and audio with local dotenv config',
        async () => {
            const result = await buildCardDemo();

            expect(result.sentence.trim().length).toBeGreaterThan(0);
            expect(result.sentenceHtml.length).toBeGreaterThan(0);
            expect(result.imageDataUrl.startsWith('data:image/')).toBe(true);
            expect(result.audioDataUrl.startsWith('data:audio/')).toBe(true);
            expect(result.imageDataUrl.length).toBeGreaterThan(100);
            expect(result.audioDataUrl.length).toBeGreaterThan(100);
        },
        120000
    );
});
