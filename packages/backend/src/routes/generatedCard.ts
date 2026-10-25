const MAX_GLOSS_CHARS = 80;

export interface GeneratedCardFields {
    sentence: string;
    gloss: string;
    reading: string;
}

export const CARD_SYSTEM_PROMPT = [
    '你是日语助教。只输出一个 JSON 对象，不要 Markdown，不要解释。',
    '字段：',
    'sentence：一句适合初学者的自然日语短句，以句号结尾。',
    'reading：这句的假名读音。汉字写成平假名，片假名保持片假名，保留原句标点。不要罗马字，不要汉字。',
    'gloss：一句简体中文释义。'
].join('\n');

export function buildCardUserPrompt (seenSentences: string[], level: string): string {
    let userContent = `请生成一句适合初学者学习的日语短句。\n\n`;
    userContent += `约束：\n1. 难度：${level} 级别（基础句型、常用助词、简单动词）。\n`;
    if (seenSentences.length > 0) {
        userContent += `2. 避免与以下已学过的句子重复或过于相似：\n`;
        seenSentences.slice(0, 50).forEach((sentence) => {
            userContent += `   - ${sentence}\n`;
        });
        userContent += `\n请生成一句新的、不重复的短句。`;
    } else {
        userContent += `2. 请生成一句自然的短句。`;
    }
    userContent += `\n按系统要求只输出 JSON。`;
    return userContent;
}

function asText (value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stripWrappingQuotes (value: string): string {
    return value.replace(/^["']|["']$/g, '').trim();
}

function cleanGloss (gloss: string, sentence: string): string {
    const compact = gloss.replace(/\s+/g, ' ').trim();
    if (!compact || compact === sentence) {
        return '';
    }
    if (!/[\u4e00-\u9fff]/.test(compact)) {
        return '';
    }
    return Array.from(compact).slice(0, MAX_GLOSS_CHARS).join('');
}

/** 模型没按 JSON 输出时，整段当作句子，读音和释义留空。 */
export function parseGeneratedCard (content: string): GeneratedCardFields {
    const trimmed = content.trim();
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            const parsed = JSON.parse(unfenced.slice(start, end + 1)) as {
                sentence?: unknown;
                gloss?: unknown;
                reading?: unknown;
            };
            const sentence = stripWrappingQuotes(asText(parsed.sentence));
            if (sentence) {
                return {
                    sentence,
                    gloss: cleanGloss(asText(parsed.gloss), sentence),
                    reading: asText(parsed.reading)
                };
            }
        } catch {
            // 落到下面的纯文本句子。
        }
    }
    return {sentence: stripWrappingQuotes(trimmed), gloss: '', reading: ''};
}
