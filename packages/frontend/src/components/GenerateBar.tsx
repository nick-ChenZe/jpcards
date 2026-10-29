import {QUOTA_EXCEEDED_MESSAGE} from '@/lib/userCopy';
import {cn} from '@/lib/utils';
import {ArrowUpRight} from 'lucide-react';
import {useState} from 'react';
import {DrawWriting} from './DrawWriting';
import {SealFoxMark} from './SealFox';

interface GenerateBarProps {
    loading: boolean;
    exhausted: boolean;
    /** 已有日签时缩短按钮文案。用尽时忽略，停止钮保持通栏。 */
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
        ? QUOTA_EXCEEDED_MESSAGE
        : compact
        ? '再抽一张'
        : '抽出今日日签';

    const draw = () => {
        if (loading || exhausted) {
            return;
        }
        setPressing(true);
        window.setTimeout(() => setPressing(false), 280);
        onGenerate();
    };

    return (
        <div className="generate-bar">
            <button
                type="button"
                className={cn('btn-draw', pressing && 'is-seal-press', exhausted && 'is-exhausted')}
                onClick={draw}
                disabled={loading || exhausted}
                aria-label={loading ? '抽签中' : label}
                aria-busy={loading}
            >
                {loading ? <DrawWriting /> : (
                    <span className="draw-label">
                        {exhausted ? null : <SealFoxMark />}
                        <span>{label}</span>
                    </span>
                )}
                <span className="draw-arrow" aria-hidden="true">
                    {loading ? <span className="draw-ink-pulse" /> : <ArrowUpRight size={24} strokeWidth={1.4} />}
                </span>
            </button>
        </div>
    );
}
