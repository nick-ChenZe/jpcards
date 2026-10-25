import {CARD_GLOSS_MISSING_MESSAGE} from '../userCopy.js';

/** 模型卡片没有非空中文释义。不要写入可练习的历史。 */
export class CardGlossError extends Error {
    readonly code = 'CARD_GLOSS_MISSING' as const;

    constructor() {
        super(CARD_GLOSS_MISSING_MESSAGE);
        this.name = 'CardGlossError';
    }
}
