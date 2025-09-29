import OpenAI from 'openai';
import dotenv from 'dotenv';
import {MessageBuilder, MessageVersion} from './src/message/MessageBuilder';
import {ToolBuilder, ToolVersion} from './src/message/ToolBuilder';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.CHAT_API_KEY,
  baseURL: process.env.CHAT_API_ENDPOINT,
});

export async function getChatCompletionStream(message: string) {
  const builder = new MessageBuilder(MessageVersion.V1, {promptDir: './src/prompt'});
  await builder.addSystemMessage();
  await builder.addUserMessage(message);

  const toolBuilder = new ToolBuilder(ToolVersion.V1, {promptDir: './src/prompt'});
  await toolBuilder.addTool('ask_question');
  await toolBuilder.addTool('save_vocabulary');

  // @ts-ignore
  return openai.chat.completions.create(
    {
      model: 'Pro/deepseek-ai/DeepSeek-V3',
      messages: builder.toJSON(),
      tools: toolBuilder.toJSON(),
      stream: true,
    }
  );
}