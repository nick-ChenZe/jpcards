export interface PracticeCard {
    sentence: string;
    gloss: string;
}

/** 没有文本模型密钥时使用。不联网。 */
const PRACTICE_CARDS: PracticeCard[] = [
    {sentence: 'こんにちは。', gloss: '你好。'},
    {sentence: 'ありがとうございます。', gloss: '谢谢。'},
    {sentence: 'これは本です。', gloss: '这是书。'},
    {sentence: '水を飲みます。', gloss: '我喝水。'},
    {sentence: '今日はいい天気です。', gloss: '今天天气很好。'}
];

export function pickPracticeCard (seenSentences: string[]): PracticeCard {
    const seen = new Set(seenSentences);
    const unseen = PRACTICE_CARDS.find((card) => !seen.has(card.sentence));
    if (unseen) {
        return unseen;
    }
    return PRACTICE_CARDS[seenSentences.length % PRACTICE_CARDS.length];
}
