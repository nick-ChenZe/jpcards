export interface SpeechPlaceholder {
    ok: false;
    code: 'TTS_NOT_CONFIGURED';
    message: string;
    audioDataUrl: '';
    audioUrl: null;
}

/** 语音是占位。不读取 MiniMax 密钥，也不发请求。 */
export function synthesizePlaceholder (): SpeechPlaceholder {
    return {
        ok: false,
        code: 'TTS_NOT_CONFIGURED',
        message: '语音未配置',
        audioDataUrl: '',
        audioUrl: null
    };
}
