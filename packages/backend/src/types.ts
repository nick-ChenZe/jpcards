import {AnyD1Database} from 'drizzle-orm/d1';

type AssetFetcher = {
    fetch: (request: Request) => Promise<Response>;
};

type R2Binding = {
    put: (
        key: string,
        value: ArrayBuffer | ArrayBufferView | string | Blob,
        options?: {
            httpMetadata?: {
                contentType?: string;
            };
        }
    ) => Promise<unknown>;
    head: (key: string) => Promise<unknown | null>;
};

/**
 * Cloudflare Workers 环境绑定类型
 * 包含 D1 数据库绑定和所有环境变量
 */
export interface Env {
    // D1 数据库绑定
    DB: AnyD1Database;
    R2: R2Binding;
    ASSETS: AssetFetcher;

    // ChatGPT / DeepSeek API
    CHAT_API_KEY: string;
    CHAT_API_ENDPOINT: string;

    // 火山引擎（图像生成）
    VOLC_API_AK: string;
    VOLC_API_SK: string;

    // MiniMax（语音合成）
    MINIMAX_ENDPOINT: string;
    MINIMAX_API_KEY: string;
    MINIMAX_MODEL: string;
    MINIMAX_VOICE_ID: string;

    // Cloudflare R2（对象存储）
    S3_PUBLIC_URL: string;
}
