import {cn} from '@/lib/utils';
import {ArrowUpRight, MoreHorizontal} from 'lucide-react';
import {useState} from 'react';

interface GenerateBarProps {
    loading: boolean;
    exhausted: boolean;
    /** hero 顶上的再抽一枚，收成小圆钮。 */
    compact?: boolean;
    onGenerate: () => void;
}

export function GenerateBar ({
    loading,
    exhausted,
    compact = false,
    onGenerate
}: GenerateBarProps) {
    const [pressing, setPressing] = useState(false);
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
                <span>{loading ? '抽签中…' : label}</span>
                <span className="draw-arrow" aria-hidden="true">
                    {loading ? <MoreHorizontal size={22} /> : <ArrowUpRight size={24} strokeWidth={1.4} />}
                </span>
            </button>
        </div>
    );
}
