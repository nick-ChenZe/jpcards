import {AnyD1Database} from 'drizzle-orm/d1';

type AssetFetcher = {
    fetch: (request: Request) => Promise<Response>;
};

/**
 * Cloudflare Workers 绑定。
 * 密钥只从这里读。请求路径不要读 process.env。
 * 不要放入 Codex / ChatGPT OAuth token。
 */
export interface Env {
    DB: AnyD1Database;
    ASSETS: AssetFetcher;

    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    BETTER_AUTH_TRUSTED_ORIGINS?: string;

    /** 文本模型。缺一则生卡关闭，且不会请求 DeepSeek。 */
    CHAT_API_KEY?: string;
    CHAT_API_ENDPOINT?: string;
    CHAT_MODEL?: string;

    /**
     * 配图：noop | qwen | seedream | openai。
     * 不填时默认 noop；只有百炼密钥 DASHSCOPE_API_KEY 或 BAILIAN_API_KEY 会改走通义。
     * seedream / openai 必须写明，不会因为密钥存在就成为默认。
     */
    IMAGE_PROVIDER?: string;
    /**
     * 通义档位。不填：正式模型 qwen-image-3.0。
     * turbo / preview / draft：只用于预览 qwen-image-2.1-turbo，评测通过前不能当默认。
     */
    QWEN_IMAGE_TIER?: string;
    /** 百炼 / DashScope。只放 Worker secret，不要写进仓库。 */
    DASHSCOPE_API_KEY?: string;
    /** 与 DASHSCOPE_API_KEY 相同用途的别名，同样只放 Worker secret。 */
    BAILIAN_API_KEY?: string;
    /** Seedream 5.0-flash。仅 IMAGE_PROVIDER=seedream 时使用。 */
    SEEDREAM_API_KEY?: string;
    /** 可选高级配图。只接受官方 API key，不接受 OAuth。仅 IMAGE_PROVIDER=openai 时使用。 */
    OPENAI_API_KEY?: string;

    S3_PUBLIC_URL?: string;
}
