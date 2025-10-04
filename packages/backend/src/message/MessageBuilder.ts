import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ChatCompletionChunk, ChatCompletionMessageParam} from 'openai/resources/chat/index.js';
import {Stream} from 'openai/streaming.js';
import {loadConversationHistory} from '../database/index.js';

export enum MessageVersion {
    V1 = 'v1'
}

export type SaveMessageFn = (params: {
    conversationId: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string;
}) => Promise<void> | void;

interface Opts {
    promptDir: string;
    saveMessage?: SaveMessageFn;
}

export class MessageBuilder {
    private _messages: Array<ChatCompletionMessageParam> = [];
    private uuid: string = '';
    private status: 'streaming' | 'completed' = 'completed';
    private stream?: Stream<ChatCompletionChunk>;
    private saveMessage?: SaveMessageFn;

    constructor(protected readonly version: MessageVersion, protected readonly opts: Opts) {
        this.uuid = randomUUID();
        this.saveMessage = opts.saveMessage;
    }

    async addFromHistory(uuid: string) {
        this.uuid = uuid;

        // 从数据库加载历史消息（按 token 预算自动裁剪）
        const history = await loadConversationHistory(uuid);

        // 按时间顺序添加历史消息
        for (const message of history) {
            this._messages.push({
                role: message.role as ChatCompletionMessageParam['role'],
                content: message.content
            } as ChatCompletionMessageParam);
        }
    }

    async addSystemMessage() {
        const systemMessage: string = await readFile(
            join(this.opts.promptDir, 'system', `${this.version}.prompt`),
            'utf8'
        );
        this._messages.push({role: 'system', content: systemMessage});
    }

    async addUserMessage(message: string) {
        this._messages.push({role: 'user', content: message});
        if (this.saveMessage) {
            await this.saveMessage({conversationId: this.uuid, role: 'user', content: message});
        }
    }

    addAssistantMessageChunk(part: string) {
        this.status = 'streaming';
        const lastMessage = this._messages[this._messages.length - 1];
        if (lastMessage.role === 'assistant') {
            lastMessage.content += part;
        } else {
            this._messages.push({role: 'assistant', content: part});
        }
    }

    endAssistantMessage() {
        this.status = 'completed';
        const lastMessage = this._messages[this._messages.length - 1];
        if (
            lastMessage && lastMessage.role === 'assistant'
            && typeof lastMessage.content === 'string'
        ) {
            if (this.saveMessage) {
                Promise.resolve(
                    this.saveMessage({
                        conversationId: this.uuid,
                        role: 'assistant',
                        content: lastMessage.content
                    })
                ).catch(() => {});
            }
        }
    }

    toJSON() {
        return this._messages;
    }

    getConversationId() {
        return this.uuid;
    }
}
