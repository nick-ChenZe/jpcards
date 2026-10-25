import {toHiragana, toRomaji} from 'wanakana';
import {type DictLoadOptions, type KanaTokenizer, loadKuromojiTokenizer} from './kuromojiDict.js';

/** 汉字（CJK 统一表意文字）范围 */
const KANJI_REGEX = /[\u4e00-\u9fff]/;

export type ReadingOptions = DictLoadOptions;

function asReadingOptions (arg?: string | ReadingOptions): ReadingOptions {
    if (typeof arg === 'string' || typeof arg === 'undefined') {
        return {assetsBaseUrl: arg};
    }
    return arg;
}

type KuromojiTokenizer = KanaTokenizer;

async function getTokenizer (arg?: string | ReadingOptions): Promise<KuromojiTokenizer | null> {
    return loadKuromojiTokenizer(asReadingOptions(arg));
}

/**
 * 将日语句子转为 HTML，仅对汉字（中文）添加罗马音标注，假名等不加。
 * 返回的 HTML 使用 <ruby> 标签，可直接用于前端渲染。
 * @param sentence 日语句子
 * @param options Workers 下传入 assetsBaseUrl 和 ASSETS.fetch。Node 测试不传时读本地词典。
 */
export async function toSentenceWithKanjiRomaji (
    sentence: string,
    options?: string | ReadingOptions
): Promise<string> {
    const tokenizer = await getTokenizer(options);
    if (!tokenizer) {
        return escapeHtml(sentence);
    }
    const tokens = tokenizer.tokenize(sentence);

    const parts: string[] = [];
    for (const token of tokens) {
        const surface = token.surface_form;
        const reading = token.reading ?? token.pronunciation ?? surface;
        const hasKanji = KANJI_REGEX.test(surface);

        if (hasKanji && reading) {
            const romaji = toRomaji(reading);
            parts.push(`<ruby>${escapeHtml(surface)}<rt>${escapeHtml(romaji)}</rt></ruby>`);
        } else {
            parts.push(escapeHtml(surface));
        }
    }
    return parts.join('');
}

function particleRomaji (surface: string): string | null {
    if (surface === 'は') {
        return 'wa';
    }
    if (surface === 'を') {
        return 'o';
    }
    if (surface === 'へ') {
        return 'e';
    }
    return null;
}

/**
 * 汉字用词典读音转平假名。表面已经是假名时保留原文，这样片假名外来语不会被折成平假名。
 */
function tokenKana (surface: string, reading: string): string {
    if (KANJI_REGEX.test(surface) && reading) {
        return toHiragana(reading);
    }
    return surface;
}

/**
 * 整句读音：假名在前，罗马音放在括号里。
 * 分词失败时返回空字符串并已在加载处打日志。调用方改用模型假名；仍然没有时，页面显示「读音这次没生成」。
 */
export async function toDisplayReading (sentence: string, options?: string | ReadingOptions): Promise<string> {
    const tokenizer = await getTokenizer(options);
    if (!tokenizer) {
        return '';
    }
    const tokens = tokenizer.tokenize(sentence);
    const kanaParts: string[] = [];
    const romajiParts: string[] = [];
    for (const token of tokens) {
        const surface = token.surface_form;
        const reading = token.reading ?? token.pronunciation ?? '';
        kanaParts.push(tokenKana(surface, reading));
        const romaji = particleRomaji(surface) ?? toRomaji(reading || surface);
        if (romaji) {
            romajiParts.push(romaji);
        }
    }
    const kana = kanaParts.join('');
    const romaji = romajiParts.join(' ').replace(/\s+([.。、！？!?，,])/g, '$1').trim();
    if (!kana && !romaji) {
        return '';
    }
    if (!romaji || kana === romaji) {
        return kana;
    }
    return `${kana}（${romaji}）`;
}

function escapeHtml (text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
