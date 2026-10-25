import {dashScopeApiKey} from '../image/qwen.js';
import type {Env} from '../types.js';
import {synthesizePlaceholder} from './placeholder.js';
import type {SpeechResult} from './types.js';

/** 非流式 Qwen-TTS。只打这个地址，避免密钥被带到别的主机。 */
export const QWEN_TTS_ENDPOINT =
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
export const QWEN_TTS_MODEL = 'qwen3-tts-flash';
const QWEN_TTS_VOICE = 'Cherry';
const QWEN_TTS_LANGUAGE = 'Japanese';
const MAX_TEXT_CHARS = 600;

function failed (): SpeechResult {
    return {
        ok: false,
        code: 'TTS_FAILED',
        provider: 'qwen',
        model: QWEN_TTS_MODEL,
        message: '语音暂时无法生成。',
        audioDataUrl: '',
        audioUrl: null
    };
}

function clipText (text: string): string {
    return Array.from(text.trim()).slice(0, MAX_TEXT_CHARS).join('');
}

/** 只接受百炼结果域名，并把 http 升成 https，方便在站点上播放。 */
export function playableAudioUrl (raw: string): string | null {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol === 'http:') {
        url.protocol = 'https:';
    }
    if (url.protocol !== 'https:') {
        return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'aliyuncs.com' && !host.endsWith('.aliyuncs.com')) {
        return null;
    }
    return url.toString();
}

/**
 * 日语练习句语音。密钥只读传入的 Worker 绑定。
 * 没有密钥时不发请求。
 */
export async function synthesizeSpeech (
    env: Env,
    text: string,
    fetchImpl: typeof fetch = fetch
): Promise<SpeechResult> {
    const apiKey = dashScopeApiKey(env);
    if (!apiKey) {
        return synthesizePlaceholder();
    }

    const spoken = clipText(text);
    if (!spoken) {
        return failed();
    }

    const request = fetchImpl ?? fetch;
    try {
        const response = await request(QWEN_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: QWEN_TTS_MODEL,
                input: {
                    text: spoken,
                    voice: QWEN_TTS_VOICE,
                    language_type: QWEN_TTS_LANGUAGE
                }
            })
        });
        if (!response.ok) {
            console.error('Qwen TTS failed', response.status);
            return failed();
        }

        const body = await response.json() as {
            code?: string;
            output?: {audio?: {url?: string;};};
        };
        if (body.code) {
            console.error('Qwen TTS failed', response.status);
            return failed();
        }
        const audioUrl = playableAudioUrl(body.output?.audio?.url ?? '');
        if (!audioUrl) {
            console.error('Qwen TTS failed', response.status);
            return failed();
        }
        return {
            ok: true,
            code: 'TTS_READY',
            provider: 'qwen',
            model: QWEN_TTS_MODEL,
            message: '',
            audioDataUrl: audioUrl,
            audioUrl
        };
    } catch (error) {
        console.error('Qwen TTS failed', error instanceof Error ? error.name : 'Error');
        return failed();
    }
}
