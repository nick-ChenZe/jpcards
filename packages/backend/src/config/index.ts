export const config = {
    env: {
        chatApiKey: process.env.CHAT_API_KEY!,
        chatApiEndpoint: process.env.CHAT_API_ENDPOINT!,
        minimaxApiKey: process.env.MINIMAX_API_KEY,
        minimaxEndpoint: process.env.MINIMAX_ENDPOINT,
        minimaxModel: process.env.MINIMAX_MODEL,
        minimaxVoiceId: process.env.MINIMAX_VOICE_ID,
        volcApiAk: process.env.VOLC_API_AK!,
        volcApiSk: process.env.VOLC_API_SK!,
        cloudflareToken: process.env.CLOUDFLARE_API_TOKEN!,
        cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        d1DatabaseId: process.env.D1_DATABASE_ID!,
        s3AccessKeyId: process.env.S3_ACCESS_KEY_ID!,
        s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        s3Endpoint: process.env.S3_ENDPOINT!,
        s3Bucket: process.env.S3_BUCKET!,
        s3PublicUrl: process.env.S3_PUBLIC_URL!
    }
};
