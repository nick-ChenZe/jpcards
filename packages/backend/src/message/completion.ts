import {encode} from 'gpt-tokenizer';
import OpenAI from 'openai';
import {config} from '../config/index.js';
import {saveMessage as dbSaveMessage} from '../database/index.js';
import {MessageBuilder, MessageVersion} from './MessageBuilder.js';
import {ToolBuilder, ToolVersion} from './ToolBuilder.js';

const openai = new OpenAI({
    apiKey: config.env.chatApiKey,
    baseURL: config.env.chatApiEndpoint
});

// 计算消息的 token 数量
function countTokens (text: string): number {
    return encode(text).length;
}

export async function* getChatCompletionStream (message: string, conversationId?: string) {
    const builder = new MessageBuilder(MessageVersion.V1, {
        promptDir: './src/prompt',
        saveMessage: async ({conversationId, role, content}) => {
            // 计算消息的 token 数量
            const tokenCount = countTokens(content);

            // 保存到数据库
            await dbSaveMessage({
                id: crypto.randomUUID(),
                conversationId,
                role,
                content,
                tokenCount
            });
        }
    });

    if (conversationId) {
        await builder.addFromHistory(conversationId);
    }

    await builder.addSystemMessage();
    await builder.addUserMessage(message);

    const toolBuilder = new ToolBuilder(ToolVersion.V1, {promptDir: './src/prompt'});
    await toolBuilder.addTool('ask_question');
    await toolBuilder.addTool('save_vocabulary');

    const stream = await openai.chat.completions.create(
        {
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: builder.toJSON(),
            tools: toolBuilder.toJSON(),
            stream: true
        }
    );

    for await (const chunk of stream) {
        const part = chunk.choices[0]?.delta?.content || '';
        builder.addAssistantMessageChunk(part);
        yield part;
    }

    builder.endAssistantMessage();
}
