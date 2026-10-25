import {describe, expect, it} from 'vitest';
import {dayCardIllustrationPrompt} from '../card.js';

describe('dayCardIllustrationPrompt', () => {
    it('keeps the sentence and asks for a warm paper palette', () => {
        const prompt = dayCardIllustrationPrompt('桜の花びらが、静かに舞い落ちる。');
        expect(prompt).toContain('桜の花びらが、静かに舞い落ちる。');
        expect(prompt).toContain('Warm paper-toned');
        expect(prompt).toContain('cream and ochre');
        expect(prompt).toContain('No near-black night scenes');
        expect(prompt).toContain('ivory washi paper');
        expect(prompt).toContain('lower third mostly pale ivory');
        expect(prompt).toContain('without drawing any written words');
    });
});
