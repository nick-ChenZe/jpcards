import {beforeEach, describe, expect, it, vi} from 'vitest';

const dict = vi.hoisted(() => ({
    loadKuromojiTokenizer: vi.fn(async () => null as null | {tokenize: (text: string) => never;})
}));

vi.mock('../kuromojiDict.js', () => ({
    loadKuromojiTokenizer: dict.loadKuromojiTokenizer
}));

import {toReadingTokens} from '../readingTokens.js';

describe('toReadingTokens failure', () => {
    beforeEach(() => {
        dict.loadKuromojiTokenizer.mockReset();
    });

    it('returns null when the dictionary is unavailable', async () => {
        dict.loadKuromojiTokenizer.mockResolvedValueOnce(null);
        await expect(toReadingTokens('こんにちは。')).resolves.toBeNull();
    });

    it('returns null when tokenize throws', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        dict.loadKuromojiTokenizer.mockResolvedValueOnce({
            tokenize() {
                throw new Error('dict exploded');
            }
        });
        try {
            await expect(toReadingTokens('こんにちは。')).resolves.toBeNull();
            expect(error.mock.calls.map((call) => String(call[0]))).toContain('[reading] tokenize failed');
        } finally {
            error.mockRestore();
        }
    });
});
