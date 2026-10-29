import {quotaSealExhaustedAttr} from '@/lib/quotaGate';
import {QUOTA_EXCEEDED_MESSAGE} from '@/lib/userCopy';

/** 余签面额。用尽写 0，读取中写 —，其余仍按两位数对齐。 */
export function quotaFaceCount (remaining: number | null): string {
    if (remaining === null) {
        return '—';
    }
    if (remaining <= 0) {
        return '0';
    }
    return String(remaining).padStart(2, '0');
}

export function QuotaSeal ({remaining, limit}: {remaining: number | null; limit: number;}) {
    const exhausted = quotaSealExhaustedAttr(remaining) === 'true';
    const count = remaining === null
        ? '正在读取今日余签'
        : `今日还可生成 ${remaining} 张，共 ${limit} 张`;
    const label = exhausted ? `${count}。${QUOTA_EXCEEDED_MESSAGE}` : count;
    return (
        <div
            className="quota-seal"
            role="status"
            aria-live="polite"
            data-exhausted={quotaSealExhaustedAttr(remaining)}
        >
            <span className="sr-only">{label}</span>
            <span className="quota-seal-face" aria-hidden="true">
                <span className="quota-seal-label">余签</span>
                <strong key={remaining}>{quotaFaceCount(remaining)}</strong>
                <span className="quota-seal-unit">枚</span>
            </span>
        </div>
    );
}
