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
}
