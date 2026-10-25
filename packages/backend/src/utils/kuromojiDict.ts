import DictionaryLoader from 'kuromoji/src/loader/DictionaryLoader.js';
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {gunzip} from 'node:zlib';

const gunzipAsync = promisify(gunzip);

export interface KanaTokenizer {
    tokenize: (text: string) => Array<{
        surface_form: string;
        reading?: string;
        pronunciation?: string;
    }>;
}

export type DictRuntime = 'node' | 'workers';

export interface DictLoadOptions {
    assetsBaseUrl?: string;
    assetFetch?: (request: Request) => Promise<Response>;
    runtime?: DictRuntime;
}

const LoaderBase = DictionaryLoader as unknown as {
    call: (thisArg: object, dicPath: string) => void;
    prototype: object;
};

interface LoaderInstance {
    load: (callback: (err: Error | null, dic: unknown) => void) => void;
}

/**
 * Workers 的 import.meta.url 同样以 file: 开头，不能据此去读 node_modules。
 * 词典在开发/部署时复制到前端静态资源 /kuromoji/dict/，再由 ASSETS 读取。
 */
export function detectDictRuntime (): DictRuntime {
    const agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return agent.includes('Cloudflare-Workers') ? 'workers' : 'node';
}

const cache = new Map<string, Promise<KanaTokenizer | null>>();

export function resetKuromojiCacheForTests (): void {
    cache.clear();
}

function cacheKey (runtime: DictRuntime, options: DictLoadOptions): string {
    if (runtime === 'node') {
        return 'node';
    }
    return `workers:${(options.assetsBaseUrl ?? '').replace(/\/+$/, '')}`;
}

function errorDetail (error: unknown): string {
    const message = error instanceof Error ? error.message : 'dict load failed';
    return message.slice(0, 180);
}

function nodeDictDirectory (): string {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return path.join(dir, '../../node_modules/kuromoji/dict');
}

export function kuromojiAssetUrl (assetsBaseUrl: string, filename: string): string {
    const base = assetsBaseUrl.replace(/\/+$/, '');
    return `${base}/kuromoji/dict/${filename}`;
}

async function inflateIfGzip (bytes: Buffer): Promise<Buffer> {
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        return gunzipAsync(bytes);
    }
    return bytes;
}

function createDictLoader (readGzip: (filename: string) => Promise<Buffer>): LoaderInstance {
    function Loader (this: LoaderInstance) {
        LoaderBase.call(this, 'dict');
    }
    Loader.prototype = Object.create(LoaderBase.prototype);
    Loader.prototype.loadArrayBuffer = function(
        file: string,
        callback: (err: Error | null, buffer: ArrayBuffer | null) => void
    ) {
        const filename = path.basename(file);
        readGzip(filename)
            .then((bytes) => inflateIfGzip(bytes))
            .then((plain) => {
                const copy = Uint8Array.from(plain);
                callback(null, copy.buffer);
            })
            .catch((error: unknown) => {
                callback(error instanceof Error ? error : new Error('dict read failed'), null);
            });
    };
    return new (Loader as unknown as new () => LoaderInstance)();
}

function buildTokenizer (readGzip: (filename: string) => Promise<Buffer>): Promise<KanaTokenizer> {
    const loader = createDictLoader(readGzip);
    return new Promise((resolve, reject) => {
        loader.load((err, dic) => {
            if (err || !dic) {
                reject(err ?? new Error('empty dictionary'));
                return;
            }
            resolve(new Tokenizer(dic));
        });
    });
}

async function readNodeGzip (filename: string): Promise<Buffer> {
    return readFile(path.join(nodeDictDirectory(), filename));
}

async function readAssetGzip (
    assetFetch: (request: Request) => Promise<Response>,
    assetsBaseUrl: string,
    filename: string
): Promise<Buffer> {
    const response = await assetFetch(new Request(kuromojiAssetUrl(assetsBaseUrl, filename)));
    if (!response.ok) {
        throw new Error(`${filename} HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

async function startLoad (runtime: DictRuntime, options: DictLoadOptions): Promise<KanaTokenizer | null> {
    if (runtime === 'workers') {
        const base = (options.assetsBaseUrl ?? '').replace(/\/+$/, '');
        if (!base || !options.assetFetch) {
            console.error('[reading] kuromoji failed', {
                reason: 'DICT_PATH_MISSING',
                detail: 'Worker 需要 assetsBaseUrl 和 ASSETS 才能读取 /kuromoji/dict/'
            });
            return null;
        }
        const assetFetch = options.assetFetch;
        return buildTokenizer((filename) => readAssetGzip(assetFetch, base, filename));
    }
    return buildTokenizer(readNodeGzip);
}

/**
 * 成功或失败都会缓存在当前隔离里。失败只记一次日志，避免每张卡重复拉取词典。
 * 卡片本身仍会另记是否改用了模型假名。
 */
export async function loadKuromojiTokenizer (options: DictLoadOptions = {}): Promise<KanaTokenizer | null> {
    const runtime = options.runtime ?? detectDictRuntime();
    const key = cacheKey(runtime, options);
    const cached = cache.get(key);
    if (cached) {
        return cached;
    }
    const pending = startLoad(runtime, options).catch((error: unknown) => {
        console.error('[reading] kuromoji failed', {
            reason: 'DICT_LOAD_FAILED',
            detail: errorDetail(error)
        });
        return null;
    });
    cache.set(key, pending);
    return pending;
}
