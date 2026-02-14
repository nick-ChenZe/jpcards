import path from 'path';
import {fileURLToPath} from 'url';
import {toRomaji} from 'wanakana';
import {installXHRPolyfill} from './xhrPolyfill.js';

/** 汉字（CJK 统一表意文字）范围 */
const KANJI_REGEX = /[\u4e00-\u9fff]/;

/** Node 下用本地 dict；Workers 下用 assets baseUrl（从 public/kuromoji/dict 部署） */
function getDicPath (assetsBaseUrl?: string): string {
    if (typeof import.meta.url !== 'undefined' && import.meta.url.startsWith('file:')) {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        return path.join(dir, '../../node_modules/kuromoji/dict');
    }
    const base = (assetsBaseUrl ?? '').replace(/\/+$/, '');
    return base ? `${base}/kuromoji/dict/` : '';
}

interface KuromojiToken {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
}

type KuromojiTokenizer = {tokenize: (text: string) => KuromojiToken[];};

let tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;

async function getTokenizer (assetsBaseUrl?: string): Promise<KuromojiTokenizer | null> {
    if (tokenizerPromise) {
        return tokenizerPromise;
    }

    tokenizerPromise = (async (): Promise<KuromojiTokenizer | null> => {
        try {
            installXHRPolyfill();

            const kuromojiModule = await import('kuromoji');
            const kuromoji = (kuromojiModule as {
                builder?: (options: {dicPath: string;}) => {
                    build: (
                        callback: (err: Error | null, tok: KuromojiTokenizer) => void
                    ) => void;
                };
            }).builder;

            if (!kuromoji) {
                return null;
            }

            const dicPath = getDicPath(assetsBaseUrl);
            if (!dicPath) {
                console.warn('Kuromoji: no dicPath (pass assetsBaseUrl in Workers)');
                return null;
            }

            return await new Promise<KuromojiTokenizer>((resolve, reject) => {
                kuromoji({dicPath}).build((err, tok) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(tok);
                });
            });
        } catch (error) {
            console.warn('Kuromoji tokenizer unavailable, fallback to plain sentence rendering:', error);
            return null;
        }
    })();

    return tokenizerPromise;
}

/**
 * 将日语句子转为 HTML，仅对汉字（中文）添加罗马音标注，假名等不加。
 * 返回的 HTML 使用 <ruby> 标签，可直接用于前端渲染。
 * @param sentence 日语句子
 * @param assetsBaseUrl Workers 下需传入请求 origin（如 new URL(req.url).origin），用于从 assets 加载 dict
 */
export async function toSentenceWithKanjiRomaji (
    sentence: string,
    assetsBaseUrl?: string
): Promise<string> {
    const tokenizer = await getTokenizer(assetsBaseUrl);
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

function escapeHtml (text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
