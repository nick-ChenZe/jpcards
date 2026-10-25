import {cn} from '@/lib/utils';
import {Button} from './ui/button';

const QUOTA_EXHAUSTED_MESSAGE = '今日额度用完了';

interface GenerateBarProps {
    remaining: number | null;
    limit: number;
    loading: boolean;
    exhausted: boolean;
    onGenerate: () => void;
}

export function GenerateBar ({
    remaining,
    limit,
    loading,
    exhausted,
    onGenerate
}: GenerateBarProps) {
    const low = remaining !== null && remaining > 0 && remaining <= 3;
    const shown = remaining === null ? '…' : String(remaining);

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
                type="button"
                size="lg"
                className={cn('card-generate disabled:opacity-100', exhausted && 'card-generate-exhausted')}
                onClick={onGenerate}
                disabled={loading || exhausted}
            >
                {loading ? '生成中...' : '生成一张卡片'}
            </Button>
            <p
                className={cn(
                    'text-sm text-ink-muted',
                    low && 'rounded-full bg-seal-soft px-3 py-1 text-ink'
                )}
                aria-live="polite"
            >
                {exhausted
                    ? QUOTA_EXHAUSTED_MESSAGE
                    : (
                        <>
                            今日还可生成{' '}
                            <span key={shown} className="quota-tick font-semibold text-ink">
                                {shown}
                            </span>
                            /{limit} 张
                        </>
                    )}
            </p>
        </div>
    );
}
