export type SpeechResult =
    | {
        ok: true;
        code: 'TTS_READY';
        provider: 'qwen';
        model: 'qwen3-tts-flash';
        message: string;
        audioDataUrl: string;
        audioUrl: string;
    }
    | {
        ok: false;
        code: 'TTS_NOT_CONFIGURED' | 'TTS_FAILED';
        provider: 'noop' | 'qwen';
        model: 'qwen3-tts-flash' | null;
        message: string;
        audioDataUrl: '';
        audioUrl: null;
    };
