import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ChatCompletionFunctionTool, FunctionDefinition} from 'openai/resources/index.js';

export enum ToolVersion {
    V1 = 'v1'
}

interface Opts {
    promptDir: string;
}

export type ToolName = 'ask_question' | 'save_vocabulary';

export class ToolBuilder {
    private tools: Array<ChatCompletionFunctionTool> = [];
    constructor(protected version: ToolVersion, protected readonly opts: Opts) {
    }

    private async readTool(toolName: ToolName): Promise<FunctionDefinition> {
        const content = await readFile(
            join(this.opts.promptDir, 'tools', toolName, `${this.version}.json`),
            'utf8'
        );
        return JSON.parse(content);
    }

    async addTool(toolName: ToolName) {
        try {
            const schema = await this.readTool(toolName);
            this.tools.push({
                type: 'function',
                function: schema
            });
        } catch (error) {
            console.error(`Failed to read tool schema: ${error}`);
        }
    }

    toJSON() {
        return this.tools;
    }
}
