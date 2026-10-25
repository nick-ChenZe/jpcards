/**
 * qwen-image-3.0 不假设高并发。接入真实请求时先 plan()，再按 waitMs 退避。
 * 间隔沿用大约 20 RPM，turbo 预览也走同一上限，评测通过前不能放宽。
 */
export const QWEN_PRO_RPM = 20;
export const QWEN_PRO_MIN_INTERVAL_MS = Math.ceil(60_000 / QWEN_PRO_RPM);

export class QwenImageLimiter {
    private nextAt = 0;

    plan(now = Date.now()): {waitMs: number; nextAt: number;} {
        const waitMs = Math.max(0, this.nextAt - now);
        const nextAt = Math.max(this.nextAt, now) + QWEN_PRO_MIN_INTERVAL_MS;
        this.nextAt = nextAt;
        return {waitMs, nextAt};
    }

    reset(): void {
        this.nextAt = 0;
    }
}

/** 同一隔离里的生图请求共用这一条队列。 */
export const qwenImageLimiter = new QwenImageLimiter();

export function resetQwenImageLimiter (): void {
    qwenImageLimiter.reset();
}

function delay (ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** 先占位，再按 waitMs 等待。真正的 HTTP 要放在这次等待之后。 */
export async function paceQwenImage (
    limiter: QwenImageLimiter = qwenImageLimiter,
    now = Date.now(),
    sleep: (ms: number) => Promise<void> = delay
): Promise<number> {
    const {waitMs} = limiter.plan(now);
    if (waitMs > 0) {
        await sleep(waitMs);
    }
    return waitMs;
}
