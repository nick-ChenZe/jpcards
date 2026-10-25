import OpenAI from 'openai';
import {assessCardGeneration, createChatFetch, type TextModelConfig} from '../config/index.js';
import {insertCardHistory, updateCardAudio, updateCardIllustration} from '../database/cardHistory.js';
import type {AppDatabase} from '../database/db.js';
import {getRecentSentences, insertSentence} from '../database/sentenceMemory.js';
import {createImageProvider, type ImageGenerationResult} from '../image/provider.js';
import {synthesizeSpeech} from '../tts/qwen.js';
import type {SpeechResult} from '../tts/types.js';
import type {Env} from '../types.js';
import {IMAGE_GENERATION_FAILED, LOCAL_PRACTICE_NOTICE} from '../userCopy.js';
import {chooseReading} from '../utils/readingChoice.js';
import {type ReadingOptions, toDisplayReading, toSentenceWithKanjiRomaji} from '../utils/romaji.js';
import {CardGlossError} from './cardGlossError.js';
import {
    buildCardUserPrompt,
    CARD_SYSTEM_PROMPT,
    type GeneratedCardFields,
    parseGeneratedCard
} from './generatedCard.js';
import {pickPracticeCard} from './practiceDeck.js';

const DEFAULT_LEVEL = 'N5';

function requireModelGloss (gloss: string): string {
    if (!gloss.trim() || !/[\u4e00-\u9fff]/.test(gloss)) {
        console.error('[card] model gloss missing');
        throw new CardGlossError();
    }
    return gloss;
}

export interface TextNotice {
    configured: boolean;
    source: 'model' | 'local';
    message: string;
}

export interface CardDemoResult {
    id?: string;
    sentence: string;
    sentenceHtml: string;
    reading: string;
    gloss: string;
    imageDataUrl: string;
    audioDataUrl: string;
    text: TextNotice;
    image: ImageGenerationResult;
    audio: SpeechResult;
}

export type CardBuildResult = {ok: true; card: CardDemoResult;};

function readingContext (env: Env, assetsBaseUrl?: string): ReadingOptions {
    if (!env.ASSETS) {
        return {assetsBaseUrl};
    }
    return {
        assetsBaseUrl,
        assetFetch: (request) => env.ASSETS.fetch(request)
    };
}

async function generateJapaneseCard (
    text: TextModelConfig,
    seenSentences: string[],
    fetchImpl?: typeof fetch
): Promise<GeneratedCardFields> {
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
            {role: 'system', content: CARD_SYSTEM_PROMPT},
            {role: 'user', content: buildCardUserPrompt(seenSentences, DEFAULT_LEVEL)}
        ]
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!content) {
        throw new Error('Text model did not return a sentence');
    }
    const parsed = parseGeneratedCard(content);
    if (!parsed.sentence) {
        throw new Error('Text model did not return a sentence');
    }
    return parsed;
}

async function resolveReading (
    sentence: string,
    modelReading: string,
    options: ReadingOptions
): Promise<string> {
    const dictReading = await toDisplayReading(sentence, options);
    const chosen = chooseReading(dictReading, modelReading);
    if (chosen.source === 'model') {
        console.error('[reading] kuromoji unavailable; stored model kana');
    } else if (chosen.source === 'none') {
        console.error('[reading] no kana stored');
    }
    return chosen.reading;
}

async function attachMedia (env: Env, sentence: string, fetchImpl?: typeof fetch): Promise<{
    image: ImageGenerationResult;
    audio: SpeechResult;
}> {
    const audio = await synthesizeSpeech(env, sentence, fetchImpl);
    try {
        const image = await createImageProvider(env).generate(
            {
                prompt: `A clean illustration that matches this Japanese sentence: ${sentence}`
            },
            env,
            fetchImpl
        );
        return {image, audio};
    } catch (error) {
        console.error('Image provider failed', error);
        return {
            image: {
                ok: false,
                code: 'IMAGE_FAILED',
                provider: 'noop',
                model: null,
                message: IMAGE_GENERATION_FAILED
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
    const generated = await generateJapaneseCard(gate.text, [], fetchImpl);
    const sentence = generated.sentence;
    const gloss = requireModelGloss(generated.gloss);
    const options = readingContext(env);
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence, options);
    const reading = await resolveReading(sentence, generated.reading, options);
    const media = await attachMedia(env, sentence, fetchImpl);
    return {
        sentence,
        sentenceHtml,
        reading,
        gloss,
        imageDataUrl: media.image.ok ? media.image.imageDataUrl : '',
        audioDataUrl: media.audio.audioDataUrl,
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
    let reading: string;
    let modelReading = '';
    let text: TextNotice;
    if (gate.enabled) {
        const generated = await generateJapaneseCard(gate.text, seenSentences, input.fetchImpl);
        sentence = generated.sentence;
        gloss = requireModelGloss(generated.gloss);
        modelReading = generated.reading;
        reading = '';
        text = {configured: true, source: 'model', message: ''};
    } else {
        const practice = pickPracticeCard(seenSentences);
        sentence = practice.sentence;
        gloss = practice.gloss;
        reading = practice.reading;
        text = {configured: false, source: 'local', message: LOCAL_PRACTICE_NOTICE};
    }
    await insertSentence(input.db, input.userId, sentence, DEFAULT_LEVEL);
    const options = readingContext(input.env, input.assetsBaseUrl);
    const sentenceHtml = await toSentenceWithKanjiRomaji(sentence, options);
    if (!reading) {
        reading = await resolveReading(sentence, modelReading, options);
    }
    const cardId = await insertCardHistory(input.db, {
        userId: input.userId,
        sentence,
        sentenceHtml,
        gloss,
        reading,
        level: DEFAULT_LEVEL
    });
    const media = await attachMedia(input.env, sentence, input.fetchImpl);
    if (media.audio.ok) {
        try {
            await updateCardAudio(input.db, cardId, input.userId, media.audio.audioUrl);
        } catch (error) {
            console.error('Failed to save card audio');
        }
    }
    if (media.image.ok && media.image.illustrationUrl) {
        try {
            await updateCardIllustration(input.db, cardId, input.userId, media.image.illustrationUrl);
        } catch (error) {
            console.error('Failed to save card illustration');
        }
    }

    return {
        ok: true,
        card: {
            id: cardId,
            sentence,
            sentenceHtml,
            reading,
            gloss,
            text,
            imageDataUrl: media.image.ok ? media.image.imageDataUrl : '',
            audioDataUrl: media.audio.audioDataUrl,
            image: media.image,
            audio: media.audio
        }
    };
}
