export interface PracticeCard {
    sentence: string;
    gloss: string;
    /** 给学习者看的读音。不依赖语音服务。 */
    reading: string;
}

/** 没有文本模型时使用。不联网。 */
const PRACTICE_CARDS: PracticeCard[] = [
    {sentence: 'こんにちは。', gloss: '你好。', reading: 'konnichiwa'},
    {sentence: 'ありがとうございます。', gloss: '谢谢。', reading: 'arigatou gozaimasu'},
    {sentence: 'これは本です。', gloss: '这是书。', reading: 'これはほんです（kore wa hon desu）'},
    {sentence: '水を飲みます。', gloss: '我喝水。', reading: 'みずをのみます（mizu o nomimasu）'},
    {
        sentence: '今日はいい天気です。',
        gloss: '今天天气很好。',
        reading: 'きょうはいいてんきです（kyou wa ii tenki desu）'
    }
];

export function pickPracticeCard (seenSentences: string[]): PracticeCard {
    const seen = new Set(seenSentences);
    const unseen = PRACTICE_CARDS.find((card) => !seen.has(card.sentence));
    if (unseen) {
        return unseen;
    }
    return PRACTICE_CARDS[seenSentences.length % PRACTICE_CARDS.length];
}

export function readingForSentence (sentence: string): string {
    return PRACTICE_CARDS.find((card) => card.sentence === sentence)?.reading ?? '';
}
