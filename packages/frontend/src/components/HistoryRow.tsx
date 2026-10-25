import {cn} from '@/lib/utils';
import {useEffect, useRef, useState} from 'react';

interface HistoryRowProps {
    sentence: string;
    date: string;
    thumbUrl?: string | null;
    onOpen: () => void;
}

export function HistoryRow ({sentence, date, thumbUrl, onOpen}: HistoryRowProps) {
    const [ready, setReady] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setReady(false);
    }, [thumbUrl]);

    useEffect(() => {
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth > 0) {
            setReady(true);
        }
    }, [thumbUrl]);

    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card-surface p-3 text-left shadow-[var(--shadow-card)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {thumbUrl
                    ? (
                        <img
                            ref={imageRef}
                            src={thumbUrl}
                            alt=""
                            onLoad={() => setReady(true)}
                            className={cn('size-full object-cover', ready ? 'paper-fade-in' : 'opacity-0')}
                        />
                    )
                    : null}
            </span>
            <span className="min-w-0 flex-1">
                <span lang="ja" className="block truncate font-japanese text-base font-medium text-ink">
                    {sentence}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">{date}</span>
            </span>
        </button>
    );
}
