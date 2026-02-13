import OpenAI from 'openai';
import {Request, Response, Router} from 'express';
import {fromNodeHeaders} from 'better-auth/node';
import {config} from '../config/index.js';
import {auth} from './auth.js';
import {getRecentSentences, insertSentence} from '../database/sentenceMemory.js';
import {insertCardHistory, updateCardAssets} from '../database/cardHistory.js';
import {toSentenceWithKanjiRomaji} from '../utils/romaji.js';
import {getImageGenerationResult, submitImageGenerationTask} from '../utils/volc.js';
import {synthesizeTextToAudioHex} from '../utils/minimax.js';
import {uploadToR2} from '../utils/r2.js';

const router = Router();

const openai = new OpenAI({
    apiKey: config.env.chatApiKey,
    baseURL: config.env.chatApiEndpoint
});

export interface CardDemoResult {
    id?: string;
    sentence: string;
    sentenceHtml: string;
    imageDataUrl: string;
    audioDataUrl: string;
}

const DEFAULT_LEVEL = 'N5';

function toDataUrl (buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function sleep (ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function generateJapaneseSentence (): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: 'Pro/deepseek-ai/DeepSeek-V3',
        temperature: 0.9,
        messages: [
            {
                role: 'system',
                content: '你是日语助教。你只输出一句自然的日语句子，不要解释，不要加引号。'
            },
            {
                role: 'user',
                content: '请随机生成一句适合初学者学习的日语短句。'
            }
        ]
    });

    const sentence = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!sentence) {
        throw new Error('DeepSeek did not return a sentence');
    }
    return sentence.replace(/^["']|["']$/g, '');
}

function buildMemoryPrompt (seenSentences: string[], level: string): string {
    let userContent = `请生成一句适合初学者学习的日语短句。\n\n`;
    userContent += `约束：\n1. 难度：${level} 级别（基础句型、常用助词、简单动词）。\n`;
    if (seenSentences.length > 0) {
        userContent += `2. 避免与以下已学过的句子重复或过于相似：\n`;
        seenSentences.slice(0, 50).forEach((s, i) => {
            userContent += `   - ${s}\n`;
        });
        userContent += `\n请生成一句新的、不重复的短句。`;
    } else {
        userContent += `2. 请生成一句自然的短句。`;
    }
    return userContent;
}

async function generateJapaneseSentenceWithMemory (
    seenSentences: string[],
    level: string = DEFAULT_LEVEL
): Promise<string> {
    const userContent = buildMemoryPrompt(seenSentences, level);
    const completion = await openai.chat.completions.create({
        model: 'Pro/deepseek-ai/DeepSeek-V3',
        temperature: 0.9,
        messages: [
            {
                role: 'system',
                content: '你是日语助教。你只输出一句自然的日语句子，不要解释，不要加引号。'
            },
            {
                role: 'user',
                content: userContent
            }
        ]
    });

    const sentence = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!sentence) {
        throw new Error('DeepSeek did not return a sentence');
    }
    return sentence.replace(/^["']|["']$/g, '');
}

async function generateImageBuffer (prompt: string): Promise<Buffer> {
    const taskId = await submitImageGenerationTask({
        req_key: 'jimeng_t2i_v31',
        prompt,
        task_id: `card-${Date.now()}`,
        width: 768,
        height: 768,
        accessKeyId: config.env.volcApiAk,
        secretAccessKey: config.env.volcApiSk
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
            return await getImageGenerationResult({
                req_key: 'jimeng_t2i_v31',
                task_id: taskId,
                accessKeyId: config.env.volcApiAk,
                secretAccessKey: config.env.volcApiSk
            });
        } catch (error) {
            lastError = error;
            await sleep(1500);
        }
    }

    throw new Error(`Failed to generate image after retries: ${String(lastError)}`);
}

async function generateImageBase64 (prompt: string): Promise<string> {
    const taskId = await submitImageGenerationTask({
        req_key: 'jimeng_t2i_v31',
        prompt,
        task_id: `card-${Date.now()}`,
        width: 768,
        height: 768,
        accessKeyId: config.env.volcApiAk,
        secretAccessKey: config.env.volcApiSk
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
            const imageBuffer = await getImageGenerationResult({
                req_key: 'jimeng_t2i_v31',
                task_id: taskId,
                accessKeyId: config.env.volcApiAk,
                secretAccessKey: config.env.volcApiSk
            });
            return toDataUrl(imageBuffer, 'image/png');
        } catch (error) {
            lastError = error;
            await sleep(1500);
        }
    }

    throw new Error(`Failed to generate image after retries: ${String(lastError)}`);
}

function resolveAudioMimeType (format: string): string {
    if (format === 'wav') {
        return 'audio/wav';
    }
    if (format === 'opus') {
        return 'audio/ogg';
    }
    return 'audio/mpeg';
}

async function generateAudioBase64 (text: string): Promise<string> {
    const audio = await synthesizeTextToAudioHex({text});
    const audioBuffer = Buffer.from(audio.audioHex, 'hex');
    return toDataUrl(audioBuffer, resolveAudioMimeType(audio.audioFormat));
}

export async function buildCardDemo (): Promise<CardDemoResult> {
    const sentence = await generateJapaneseSentence();
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence);
    const imagePrompt = `A clean and Noritake style illustration that matches this Japanese sentence: ${sentence}`;
    const [imageDataUrl, audioDataUrl] = await Promise.all([
        generateImageBase64(imagePrompt),
        generateAudioBase64(sentence)
    ]);
    return {
        sentence,
        sentenceHtml,
        imageDataUrl,
        audioDataUrl
    };
}

export async function buildCardWithMemory (userId: string): Promise<CardDemoResult> {
    const seenSentences = await getRecentSentences(userId);
    const sentence = await generateJapaneseSentenceWithMemory(seenSentences, DEFAULT_LEVEL);
    await insertSentence(userId, sentence, DEFAULT_LEVEL);
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence);
    const imagePrompt = `A clean and Noritake style illustration that matches this Japanese sentence: ${sentence}`;

    // 生成图片和音频（获取原始 Buffer 用于上传 R2）
    const [imageBuffer, audioResult] = await Promise.all([
        generateImageBuffer(imagePrompt),
        synthesizeTextToAudioHex({text: sentence})
    ]);
    const audioBuffer = Buffer.from(audioResult.audioHex, 'hex');

    // 先插入卡片历史记录获取 UUID
    const cardId = await insertCardHistory({
        userId,
        sentence,
        sentenceHtml,
        level: DEFAULT_LEVEL
    });

    // 上传音频和插图到 R2
    const audioKey = `audio/${cardId}.mp3`;
    const illustrationKey = `illustration/${cardId}.png`;
    const bucket = config.env.s3Bucket;
    const publicBase = config.env.s3PublicUrl;

    await Promise.all([
        uploadToR2({bucket, key: audioKey, body: audioBuffer, contentType: resolveAudioMimeType(audioResult.audioFormat)}),
        uploadToR2({bucket, key: illustrationKey, body: imageBuffer, contentType: 'image/png'})
    ]);

    // 构建公开访问 URL 并更新记录
    const audioUrl = `${publicBase}/${audioKey}`;
    const illustrationUrl = `${publicBase}/${illustrationKey}`;
    await updateCardAssets(cardId, audioUrl, illustrationUrl);

    // 同时返回 data URL 给前端直接渲染（避免客户端额外请求）
    const imageDataUrl = toDataUrl(imageBuffer, 'image/png');
    const audioDataUrl = toDataUrl(audioBuffer, resolveAudioMimeType(audioResult.audioFormat));

    return {
        id: cardId,
        sentence,
        sentenceHtml,
        imageDataUrl,
        audioDataUrl
    };
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });
        const card = session
            ? await buildCardWithMemory(session.user.id)
            : await buildCardDemo();
        res.json(card);
    } catch (error) {
        console.error('Failed to build card demo:', error);
        res.status(500).json({
            error: 'Failed to build card demo',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
