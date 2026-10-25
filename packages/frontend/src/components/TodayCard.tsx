import {cn} from '@/lib/utils';
import {Pause, Play} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {CardReading} from './CardReading';

export interface TodayCardProps {
    loading?: boolean;
    loadingLabel?: string;
    sentenceHtml?: string;
    reading?: string;
    gloss?: string;
    imageUrl?: string | null;
    imageMessage?: string;
    audioUrl?: string | null;
    note?: string;
    meta?: string;
}

function CardSkeleton ({label}: {label: string;}) {
    return (
        <div
            className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-surface shadow-[var(--shadow-card)]"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <span className="sr-only">{label}</span>
            <div className="paper-breathe aspect-[4/3] w-full" />
            <div className="space-y-3 px-5 py-5">
                <div className="paper-breathe h-4 w-11/12 rounded" />
                <div className="paper-breathe paper-breathe-delay-1 h-4 w-2/3 rounded" />
                <div className="paper-breathe paper-breathe-delay-2 h-4 w-1/2 rounded" />
            </div>
        </div>
    );
}

function CardImage ({url, message}: {url?: string | null; message?: string;}) {
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setFailed(false);
        setReady(false);
    }, [url]);

    useEffect(() => {
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth > 0) {
            setReady(true);
        }
    }, [url]);

    if (!url || failed) {
        return (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted px-6 text-center text-sm text-ink-muted">
                {message || '配图暂未开通'}
            </div>
        );
    }

    return (
        <div className="aspect-[4/3] w-full bg-muted">
            <img
                ref={imageRef}
                src={url}
                alt="日语句子配图"
                onLoad={() => setReady(true)}
                onError={() => setFailed(true)}
                className={cn('size-full object-cover', ready ? 'paper-fade-in' : 'opacity-0')}
            />
        </div>
    );
}

function CardPlayButton ({src}: {src: string;}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const audio = new Audio(src);
        audio.preload = 'none';
        audioRef.current = audio;
        const onEnded = () => setPlaying(false);
        const onPause = () => setPlaying(false);
        const onPlay = () => setPlaying(true);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('play', onPlay);
        return () => {
            audio.pause();
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('play', onPlay);
            audioRef.current = null;
        };
    }, [src]);

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }
        if (!audio.paused) {
            audio.pause();
            return;
        }
        void audio.play().catch(() => setPlaying(false));
    };

    return (
        <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full border border-seal bg-card-surface text-seal shadow-[var(--shadow-card)] hover:bg-seal-soft"
            aria-label={playing ? '暂停朗读' : '播放朗读'}
            aria-pressed={playing}
            onClick={toggle}
        >
            {playing
                ? <Pause className="size-4" />
                : <Play className="size-4 translate-x-px" />}
        </button>
    );
}

export function TodayCard ({
    loading = false,
    loadingLabel = '正在生成卡片',
    sentenceHtml,
    reading,
    gloss,
    imageUrl,
    imageMessage,
    audioUrl,
    note,
    meta
}: TodayCardProps) {
    if (loading) {
        return <CardSkeleton label={loadingLabel} />;
    }

    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-surface shadow-[var(--shadow-card)]">
            <CardImage url={imageUrl} message={imageMessage} />
            <div className="space-y-3 px-5 py-5">
                {sentenceHtml
                    ? (
                        <div
                            lang="ja"
                            className="font-japanese text-[1.35rem] font-medium leading-relaxed text-ink [&_ruby]:font-normal"
                            dangerouslySetInnerHTML={{__html: sentenceHtml}}
                        />
                    )
                    : null}
                <CardReading reading={reading} />
                {gloss
                    ? <p className="text-sm leading-6 text-ink">{gloss}</p>
                    : null}
                {note
                    ? <p className="text-sm leading-6 text-ink-muted">{note}</p>
                    : null}
                {meta
                    ? <p className="text-xs text-ink-muted">{meta}</p>
                    : null}
                {audioUrl ? <CardPlayButton src={audioUrl} /> : null}
            </div>
        </article>
    );
}
