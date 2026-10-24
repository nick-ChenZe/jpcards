import type {Env} from '../types.js';

export interface TextModelConfig {
    chatApiKey: string;
    chatApiEndpoint: string;
    chatModel: string;
}

export type CardGenerationGate =
    | {enabled: true; text: TextModelConfig;}
    | {enabled: false; code: 'CARD_GEN_DISABLED';};

const DEFAULT_CHAT_MODEL = 'Pro/deepseek-ai/DeepSeek-V3';

/** 生图 / 语音厂商。文本请求不允许打到这些主机。 */
const PAID_MEDIA_HOST_SUFFIXES = [
    'volcengineapi.com',
    'volces.com',
    'minimax.io',
    'minimax.chat',
    'minimaxi.com'
];

export function isPaidMediaHost (hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.+$/, '');
    return PAID_MEDIA_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function assessCardGeneration (env: Env): CardGenerationGate {
    const chatApiKey = env.CHAT_API_KEY?.trim() ?? '';
    const chatApiEndpoint = env.CHAT_API_ENDPOINT?.trim() ?? '';
    if (!chatApiKey || !chatApiEndpoint) {
        return {enabled: false, code: 'CARD_GEN_DISABLED'};
    }

    let endpoint: URL;
    try {
        endpoint = new URL(chatApiEndpoint);
    } catch {
        return {enabled: false, code: 'CARD_GEN_DISABLED'};
    }

    if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
        return {enabled: false, code: 'CARD_GEN_DISABLED'};
    }

    if (isPaidMediaHost(endpoint.hostname)) {
        return {enabled: false, code: 'CARD_GEN_DISABLED'};
    }

    return {
        enabled: true,
        text: {
            chatApiKey,
            chatApiEndpoint,
            chatModel: env.CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL
        }
    };
}

export function createChatFetch (chatApiEndpoint: string, baseFetch: typeof fetch = fetch): typeof fetch {
    const allowed = new URL(chatApiEndpoint);
    if (isPaidMediaHost(allowed.hostname)) {
        throw new Error('Refusing to use an image or TTS host as the text model endpoint');
    }

    return async (input, init) => {
        const url = resolveRequestUrl(input);
        if (isPaidMediaHost(url.hostname) || url.origin !== allowed.origin) {
            throw new Error('Blocked outbound request');
        }
        return baseFetch(input, init);
    };
}

function resolveRequestUrl (input: string | URL | {url: string;}): URL {
    if (typeof input === 'string') {
        return new URL(input);
    }
    if (input instanceof URL) {
        return input;
    }
    return new URL(input.url);
}
