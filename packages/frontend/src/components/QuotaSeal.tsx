import {quotaSealExhaustedAttr} from '@/lib/quotaGate';
import {QUOTA_EXCEEDED_MESSAGE} from '@/lib/userCopy';

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
                <strong key={remaining}>{remaining === null ? '—' : String(remaining).padStart(2, '0')}</strong>
                <span className="quota-seal-unit">枚</span>
            </span>
        </div>
    );
}
