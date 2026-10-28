import {QUOTA_EXCEEDED_MESSAGE} from './userCopy';

export interface QuotaSnapshot {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
}

export function isQuotaSnapshot (value: unknown): value is QuotaSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const quota = value as Partial<QuotaSnapshot>;
    return typeof quota.limit === 'number'
        && typeof quota.used === 'number'
        && typeof quota.remaining === 'number'
        && typeof quota.resetsAt === 'string';
}

/**
 * 余签还没读到时仍可点，交给服务端拦截。
 * 已知用尽或上一发还在飞，就停住，不再发请求。
 */
export function gateDrawAttempt (input: {inFlight: boolean; remaining: number | null;}): 'stop' | 'start' {
    if (input.inFlight || (input.remaining !== null && input.remaining <= 0)) {
        return 'stop';
    }
    return 'start';
}

/** 与后端 429 `QUOTA_EXCEEDED` 对齐。冷却是另一句，不算用尽。 */
export function isQuotaExceededDenial (
    status: number,
    body: {error?: unknown; message?: unknown;} | null | undefined
): boolean {
    return status === 429 && (
        body?.error === 'QUOTA_EXCEEDED' || body?.message === QUOTA_EXCEEDED_MESSAGE
    );
}

/** 已知用尽才写 `data-exhausted="true"`，读取中不假装用尽。 */
export function quotaSealExhaustedAttr (remaining: number | null): 'true' | undefined {
    return remaining !== null && remaining <= 0 ? 'true' : undefined;
}
