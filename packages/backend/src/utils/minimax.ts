import axios from 'axios';
import {createHash, randomUUID} from 'crypto';
import {config} from '../config/index.js';

export interface TextToAudioInput {
    text: string;
    voice?: string;
    format?: 'mp3' | 'wav' | 'opus';
    speed?: number;
}

interface MinimaxT2aResponse {
    base_resp?: {
        status_code?: number;
        status_msg?: string;
    };
    trace_id?: string;
    data?: {
        audio?: string;
        audio_base64?: string;
        audio_hex?: string;
        audio_file?: string;
        audio_url?: string;
        format?: string;
        sample_rate?: number;
        duration_ms?: number;
    };
}

function isHexString (value: string): boolean {
    return /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0;
}

async function downloadAudioAsBuffer (url: string, requestId: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[${requestId}] failed to download audio: ${res.status} ${res.statusText}`);
    }
    const bytes = await res.arrayBuffer();
    return Buffer.from(bytes);
}

async function resolveAudioBuffer (
    result: MinimaxT2aResponse,
    requestId: string
): Promise<{buffer: Buffer; format?: string; sampleRate?: number; durationMs?: number;}> {
    const data = result.data ?? {};
    const audioRaw = data.audio_hex ?? data.audio ?? data.audio_base64;

    if (typeof audioRaw === 'string' && audioRaw.length > 0) {
        if (isHexString(audioRaw)) {
            return {
                buffer: Buffer.from(audioRaw, 'hex'),
                format: data.format,
                sampleRate: data.sample_rate,
                durationMs: data.duration_ms
            };
        }

        return {
            buffer: Buffer.from(audioRaw, 'base64'),
            format: data.format,
            sampleRate: data.sample_rate,
            durationMs: data.duration_ms
        };
    }

    const audioUrl = data.audio_url ?? data.audio_file;
    if (typeof audioUrl === 'string' && audioUrl.length > 0) {
        const buffer = await downloadAudioAsBuffer(audioUrl, requestId);
        return {
            buffer,
            format: data.format,
            sampleRate: data.sample_rate,
            durationMs: data.duration_ms
        };
    }

    throw new Error(`[${requestId}] no audio content returned from minimax`);
}

export async function synthesizeTextToAudioHex (input: TextToAudioInput): Promise<{
    audioHex: string;
    audioFormat: string;
    sizeBytes: number;
    sha256: string;
}> {
    const requestId = randomUUID();
    const voiceId = config.env.minimaxVoiceId!;
    const requestPayload = {
        model: config.env.minimaxModel,
        text: input.text,
        stream: false,
        voice_setting: {
            voice_id: voiceId,
            speed: input.speed ?? 1.0
        },
        audio_setting: {
            format: 'mp3'
        }
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.env.minimaxApiKey}`
    };

    const requestUrl = config.env.minimaxEndpoint!;
    const response = await axios.post<MinimaxT2aResponse>(requestUrl, requestPayload, {headers});

    const data = response.data;
    const statusCode = data.base_resp?.status_code ?? 0;
    if (statusCode !== 0) {
        throw new Error(
            `[${requestId}] minimax business error (${statusCode}): ${data.base_resp?.status_msg ?? 'unknown'}`
        );
    }

    const resolved = await resolveAudioBuffer(data, requestId);
    const audioHex = resolved.buffer.toString('hex');
    const sha256 = createHash('sha256').update(resolved.buffer).digest('hex');

    return {
        audioHex,
        audioFormat: resolved.format!,
        sizeBytes: resolved.buffer.byteLength,
        sha256
    };
}
