import {createRequire} from 'module';
import path from 'path';
import {fileURLToPath} from 'url';
import {toRomaji} from 'wanakana';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 汉字（CJK 统一表意文字）范围 */
const KANJI_REGEX = /[\u4e00-\u9fff]/;

interface KuromojiToken {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
}

let tokenizerPromise: Promise<{tokenize: (text: string) => KuromojiToken[]}> | null = null;

function getTokenizer (): Promise<{tokenize: (text: string) => KuromojiToken[]}> {
    if (tokenizerPromise) {
        return tokenizerPromise;
    }
    const kuromojiPath = path.dirname(require.resolve('kuromoji/package.json'));
    const dicPath = path.join(kuromojiPath, 'dict');

    tokenizerPromise = new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const kuromoji = require('kuromoji');
        kuromoji.builder({dicPath}).build((err: Error | null, tok: {tokenize: (text: string) => KuromojiToken[]}) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(tok);
        });
    });
    return tokenizerPromise;
}

/**
 * 将日语句子转为 HTML，仅对汉字（中文）添加罗马音标注，假名等不加。
 * 返回的 HTML 使用 <ruby> 标签，可直接用于前端渲染。
 */
export async function toSentenceWithKanjiRomaji (sentence: string): Promise<string> {
    const tokenizer = await getTokenizer();
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

function escapeHtml (text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
