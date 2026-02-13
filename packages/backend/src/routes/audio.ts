import {Request, Response, Router} from 'express';
import {synthesizeTextToAudioHex} from '../utils/minimax.js';

const router = Router();

interface TextToAudioHexRequest {
    text: string;
    voice?: string;
    format?: 'mp3' | 'wav' | 'opus';
    sampleRate?: 16000 | 22050 | 24000 | 44100;
    speed?: number;
}

function validateRequestBody (body: TextToAudioHexRequest): string | null {
    if (typeof body.text !== 'string') {
        return 'text must be a string';
    }
    if (body.text.trim().length === 0 || body.text.length > 2000) {
        return 'text must be between 1 and 2000 characters';
    }
    if (body.voice !== undefined && typeof body.voice !== 'string') {
        return 'voice must be a string';
    }
    if (body.format !== undefined && !['mp3', 'wav', 'opus'].includes(body.format)) {
        return 'format must be one of mp3, wav, opus';
    }
    if (
        body.sampleRate !== undefined &&
        ![16000, 22050, 24000, 44100].includes(body.sampleRate)
    ) {
        return 'sampleRate must be one of 16000, 22050, 24000, 44100';
    }
    if (body.speed !== undefined && (typeof body.speed !== 'number' || body.speed < 0.5 || body.speed > 2.0)) {
        return 'speed must be between 0.5 and 2.0';
    }
    return null;
}

router.post('/text-to-hex', async (req: Request<{}, {}, TextToAudioHexRequest>, res: Response) => {
    const validationError = validateRequestBody(req.body);
    if (validationError) {
        res.status(400).json({
            error: {
                code: 'INVALID_REQUEST',
                message: validationError
            }
        });
        return;
    }

    try {
        const result = await synthesizeTextToAudioHex(req.body);
        res.status(200).json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to synthesize text to audio hex:', error);
        res.status(500).json({
            error: {
                code: 'UPSTREAM_TTS_FAILED',
                message
            }
        });
    }
});

export default router;
