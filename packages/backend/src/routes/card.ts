import OpenAI from 'openai';
import {assessCardGeneration, createChatFetch, type TextModelConfig} from '../config/index.js';
import {insertCardHistory} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {getRecentSentences, insertSentence} from '../database/sentenceMemory.js';
import {createImageProvider, type ImageGenerationResult} from '../image/provider.js';
import {type SpeechPlaceholder, synthesizePlaceholder} from '../tts/placeholder.js';
import type {Env} from '../types.js';
import {toSentenceWithKanjiRomaji} from '../utils/romaji.js';
import {pickPracticeCard} from './practiceDeck.js';

const DEFAULT_LEVEL = 'N5';
const LOCAL_TEXT_MESSAGE = '文本模型尚未配置。这张是本地练习卡片，没有请求外部服务。';

export interface TextNotice {
    configured: boolean;
    source: 'model' | 'local';
    message: string;
}

export interface CardDemoResult {
    id?: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    imageDataUrl: string;
    audioDataUrl: string;
    text: TextNotice;
    image: ImageGenerationResult;
    audio: SpeechPlaceholder;
}

export type CardBuildResult = {ok: true; card: CardDemoResult;};

async function generateJapaneseSentence (
    text: TextModelConfig,
    seenSentences: string[],
    fetchImpl?: typeof fetch
): Promise<string> {
    const client = new OpenAI({
        apiKey: text.chatApiKey,
        baseURL: text.chatApiEndpoint,
        fetch: createChatFetch(text.chatApiEndpoint, fetchImpl),
        maxRetries: 0
    });
    const completion = await client.chat.completions.create({
        model: text.chatModel,
        temperature: 0.9,
        messages: [
            {
                role: 'system',
                content: '你是日语助教。你只输出一句自然的日语句子，不要解释，不要加引号。'
            },
            {
                role: 'user',
                content: buildMemoryPrompt(seenSentences, DEFAULT_LEVEL)
            }
        ]
    });

    const sentence = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!sentence) {
        throw new Error('Text model did not return a sentence');
    }
    return sentence.replace(/^["']|["']$/g, '');
}

function buildMemoryPrompt (seenSentences: string[], level: string): string {
    let userContent = `请生成一句适合初学者学习的日语短句。\n\n`;
    userContent += `约束：\n1. 难度：${level} 级别（基础句型、常用助词、简单动词）。\n`;
    if (seenSentences.length > 0) {
        userContent += `2. 避免与以下已学过的句子重复或过于相似：\n`;
        seenSentences.slice(0, 50).forEach((s) => {
            userContent += `   - ${s}\n`;
        });
        userContent += `\n请生成一句新的、不重复的短句。`;
    } else {
        userContent += `2. 请生成一句自然的短句。`;
    }
    return userContent;
}

async function attachMedia (env: Env, sentence: string): Promise<{
    image: ImageGenerationResult;
    audio: SpeechPlaceholder;
}> {
    const audio = synthesizePlaceholder();
    try {
        const image = await createImageProvider(env).generate({
            prompt: `A clean illustration that matches this Japanese sentence: ${sentence}`
        }, env);
        return {image, audio};
    } catch (error) {
        console.error('Image provider failed', error);
        return {
            image: {
                ok: false,
                code: 'IMAGE_DISABLED',
                provider: 'noop',
                model: null,
                message: '配图未配置'
            },
            audio
        };
    }
}

export async function buildCardDemo (
    env: Env,
    fetchImpl?: typeof fetch
): Promise<CardDemoResult> {
    const gate = assessCardGeneration(env);
    if (!gate.enabled) {
        throw new Error('CARD_GEN_DISABLED');
    }
    const sentence = await generateJapaneseSentence(gate.text, [], fetchImpl);
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence);
    const media = await attachMedia(env, sentence);
    return {
        sentence,
        sentenceHtml,
        gloss: '',
        imageDataUrl: media.image.ok ? media.image.imageDataUrl : '',
        audioDataUrl: '',
        text: {configured: true, source: 'model', message: ''},
        image: media.image,
        audio: media.audio
    };
}

export async function buildCardWithMemory (input: {
    db: AppDatabase;
    userId: string;
    env: Env;
    assetsBaseUrl?: string;
    fetchImpl?: typeof fetch;
}): Promise<CardBuildResult> {
    const gate = assessCardGeneration(input.env);
    const seenSentences = await getRecentSentences(input.db, input.userId);
    let sentence: string;
    let gloss: string;
    let text: TextNotice;
    if (gate.enabled) {
        sentence = await generateJapaneseSentence(gate.text, seenSentences, input.fetchImpl);
        gloss = '';
        text = {configured: true, source: 'model', message: ''};
    } else {
        const practice = pickPracticeCard(seenSentences);
        sentence = practice.sentence;
        gloss = practice.gloss;
        text = {configured: false, source: 'local', message: LOCAL_TEXT_MESSAGE};
    }
    await insertSentence(input.db, input.userId, sentence, DEFAULT_LEVEL);
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence, input.assetsBaseUrl);
    const cardId = await insertCardHistory(input.db, {
        userId: input.userId,
        sentence,
        sentenceHtml,
        gloss,
        level: DEFAULT_LEVEL
    });
    const media = await attachMedia(input.env, sentence);

    return {
        ok: true,
        card: {
            id: cardId,
            sentence,
            sentenceHtml,
            gloss,
            text,
            imageDataUrl: media.image.ok ? media.image.imageDataUrl : '',
            audioDataUrl: '',
            image: media.image,
            audio: media.audio
        }
    };
}
