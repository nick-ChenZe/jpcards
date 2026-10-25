import type {SpeechResult} from './types.js';

/** 没有百炼密钥时的结果。不发请求。 */
export function synthesizePlaceholder (): SpeechResult {
    return {
        ok: false,
        code: 'TTS_NOT_CONFIGURED',
        provider: 'noop',
        model: null,
        message: '语音未配置',
        audioDataUrl: '',
        audioUrl: null
    };
}
