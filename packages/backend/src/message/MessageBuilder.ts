import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {ChatCompletionMessageParam, ChatCompletionSystemMessageParam} from "openai/resources/index"

export enum MessageVersion {
    V1 = 'v1',
}

interface Opts {
    promptDir: string
}

export class MessageBuilder {
    private _messages: Array<ChatCompletionMessageParam> = []
    constructor(protected version: MessageVersion, protected readonly opts: Opts) {
    }

    async addSystemMessage() {
        const systemMessage: string = await readFile(join(this.opts.promptDir, 'system', `${this.version}.prompt`), 'utf8');
        this._messages.push({role: 'system', content: systemMessage});
    }

    async addUserMessage(message: string) {
        this._messages.push({role: 'user', content: message});
    }

    toJSON() {
        return this._messages;
    }
}