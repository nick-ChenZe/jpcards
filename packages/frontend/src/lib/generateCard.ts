/** 一次点击一把钥匙。POST 不会被浏览器当成可重试的 GET。 */
export function createCardIdempotencyKey (): string {
    return crypto.randomUUID();
}

export function generateCardInit (key: string = createCardIdempotencyKey()): RequestInit {
    return {
        method: 'POST',
        credentials: 'include',
        headers: {'Idempotency-Key': key}
    };
}
