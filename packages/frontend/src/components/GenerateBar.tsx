import {QUOTA_EXCEEDED_MESSAGE} from '@/lib/userCopy';
import {cn} from '@/lib/utils';
import {useState} from 'react';

interface GenerateBarProps {
    remaining: number | null;
    limit: number;
    loading: boolean;
    exhausted: boolean;
    /** hero 顶上的再抽一枚，收成小圆钮。 */
    compact?: boolean;
    onGenerate: () => void;
}

export function GenerateBar ({
    remaining,
    limit,
    loading,
    exhausted,
    compact = false,
    onGenerate
}: GenerateBarProps) {
    const [pressing, setPressing] = useState(false);
    const shown = remaining === null ? '…' : String(remaining);
    const label = exhausted
        ? '今日次数已用完'
        : compact
        ? '再抽一张'
        : '抽出今日日签';

    const draw = () => {
        if (loading || exhausted) {
            return;
        }
        setPressing(true);
        window.setTimeout(() => setPressing(false), 360);
        onGenerate();
    };

    return (
        <div className="generate-bar">
            <button
                type="button"
                className={cn('btn-draw', pressing && 'pressing')}
                onClick={draw}
                disabled={loading || exhausted}
            >
                <span className="seal-mark" aria-hidden="true">抽</span>
                <span>{loading ? '抽签中…' : label}</span>
            </button>
            <p className="quota-hint" aria-live="polite">
                {exhausted
                    ? QUOTA_EXCEEDED_MESSAGE
                    : (
                        <>
                            今日还可生成 <span key={shown} className="num quota-tick">{shown}</span>
                            /{limit}
                        </>
                    )}
            </p>
        </div>
    );
}
