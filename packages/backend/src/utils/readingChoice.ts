import {toRomaji} from 'wanakana';

const KANJI = /[\u4e00-\u9fff]/;
const KANA = /[\u3040-\u30ff]/;

export function hasKana (value: string): boolean {
    return KANA.test(value);
}

/** 把假名读音收成「假名（罗马音）」。含汉字或没有假名时返回空字符串。 */
export function formatKanaReading (raw: string): string {
    const withoutParen = raw.replace(/[（(][^）)]*[）)]/g, '');
    const kana = withoutParen.replace(/[A-Za-z]+/g, '').replace(/\s+/g, '');
    if (!kana || !hasKana(kana) || KANJI.test(kana)) {
        return '';
    }
    const romaji = toRomaji(kana).replace(/\s+([.。、！？!?，,])/g, '$1').trim();
    if (!romaji || kana === romaji) {
        return kana;
    }
    return `${kana}（${romaji}）`;
}

export function chooseReading (
    dictReading: string,
    modelReading: string
): {reading: string; source: 'dict' | 'model' | 'none';} {
    if (hasKana(dictReading)) {
        return {reading: dictReading.trim(), source: 'dict'};
    }
    const formatted = formatKanaReading(modelReading);
    if (formatted) {
        return {reading: formatted, source: 'model'};
    }
    return {reading: '', source: 'none'};
}
