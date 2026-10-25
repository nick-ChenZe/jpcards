import {parseReadingTokens, playbackTokenIndex, readingLineParts, splitSentenceHtml} from '@/lib/readingHighlight';
import {cn} from '@/lib/utils';
import {Pause, Play} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {CardReading} from './CardReading';

export interface TodayCardProps {
    loading?: boolean;
    loadingLabel?: string;
    sentenceHtml?: string;
    reading?: string;
    readingTokens?: unknown;
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

interface PlaybackSample {
    currentTime: number;
    duration: number;
    ended: boolean;
}

const IDLE_SAMPLE: PlaybackSample = {currentTime: 0, duration: 0, ended: false};

/**
 * 圆形播放钮和词高亮共用这一份 Audio。不要再 new 一个，也不要另放 controls 播放器。
 */
function useCardAudio (src: string | null | undefined) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [sample, setSample] = useState<PlaybackSample>(IDLE_SAMPLE);

    useEffect(() => {
        if (!src) {
            setPlaying(false);
            setSample(IDLE_SAMPLE);
            return;
        }
        let disposed = false;
        const audio = new Audio(src);
        audio.preload = 'none';
        audioRef.current = audio;
        const publish = () => {
            if (disposed) {
                return;
            }
            setPlaying(!audio.paused && !audio.ended);
            setSample({
                currentTime: audio.currentTime || 0,
                duration: Number.isFinite(audio.duration) ? audio.duration : 0,
                ended: audio.ended
            });
        };
        const events = ['play', 'pause', 'ended', 'timeupdate', 'seeked', 'loadedmetadata', 'durationchange'] as const;
        for (const event of events) {
            audio.addEventListener(event, publish);
        }
        return () => {
            disposed = true;
            audio.pause();
            for (const event of events) {
                audio.removeEventListener(event, publish);
            }
            if (audioRef.current === audio) {
                audioRef.current = null;
            }
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

    return {playing, toggle, sample};
}

function CardPlayButton ({playing, onToggle}: {playing: boolean; onToggle: () => void;}) {
    return (
        <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full border border-seal bg-card-surface text-seal shadow-[var(--shadow-card)] hover:bg-seal-soft"
            aria-label={playing ? '暂停朗读' : '播放朗读'}
            aria-pressed={playing}
            onClick={onToggle}
        >
            {playing
                ? <Pause className="size-4" />
                : <Play className="size-4 translate-x-px" />}
        </button>
    );
}

function CardSentence ({
    sentenceHtml,
    surfaces,
    segments,
    activeIndex
}: {
    sentenceHtml?: string;
    surfaces: string[] | null;
    segments: string[] | null;
    activeIndex: number | null;
}) {
    if (surfaces && segments) {
        return (
            <div
                lang="ja"
                className="font-japanese text-[1.35rem] font-medium leading-relaxed text-ink [&_ruby]:font-normal"
            >
                {surfaces.map((surface, index) => (
                    <span
                        key={`${index}-${surface}`}
                        className={index === activeIndex ? 'mora-token-active' : undefined}
                        dangerouslySetInnerHTML={{__html: segments[index] ?? ''}}
                    />
                ))}
            </div>
        );
    }
    if (!sentenceHtml) {
        if (!surfaces || surfaces.length === 0) {
            return null;
        }
        return (
            <div
                lang="ja"
                className="font-japanese text-[1.35rem] font-medium leading-relaxed text-ink"
            >
                {surfaces.map((surface, index) => (
                    <span
                        key={`${index}-${surface}`}
                        className={index === activeIndex ? 'mora-token-active' : undefined}
                    >
                        {surface}
                    </span>
                ))}
            </div>
        );
    }
    return (
        <div
            lang="ja"
            className="font-japanese text-[1.35rem] font-medium leading-relaxed text-ink [&_ruby]:font-normal"
            dangerouslySetInnerHTML={{__html: sentenceHtml}}
        />
    );
}

export function TodayCard ({
    loading = false,
    loadingLabel = '正在生成卡片',
    sentenceHtml,
    reading,
    readingTokens,
    gloss,
    imageUrl,
    imageMessage,
    audioUrl,
    note,
    meta
}: TodayCardProps) {
    const tokens = parseReadingTokens(readingTokens);
    const playback = useCardAudio(audioUrl);
    const activeIndex = playbackTokenIndex(
        tokens,
        playback.sample.currentTime,
        playback.sample.duration,
        playback.playing,
        playback.sample.ended
    );
    const surfaces = tokens?.map((token) => token.surface) ?? null;
    const segments = sentenceHtml && surfaces ? splitSentenceHtml(sentenceHtml, surfaces) : null;
    const readingParts = tokens && reading ? readingLineParts(reading, tokens) : null;

    if (loading) {
        return <CardSkeleton label={loadingLabel} />;
    }

    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-surface shadow-[var(--shadow-card)]">
            <CardImage url={imageUrl} message={imageMessage} />
            <div className="space-y-3 px-5 py-5">
                <CardSentence
                    sentenceHtml={sentenceHtml}
                    surfaces={surfaces}
                    segments={segments}
                    activeIndex={segments || !sentenceHtml ? activeIndex : null}
                />
                <CardReading reading={reading} parts={readingParts} activeIndex={activeIndex} />
                {gloss
                    ? <p className="text-sm leading-6 text-ink">{gloss}</p>
                    : null}
                {note
                    ? <p className="text-sm leading-6 text-ink-muted">{note}</p>
                    : null}
                {meta
                    ? <p className="text-xs text-ink-muted">{meta}</p>
                    : null}
                {audioUrl ? <CardPlayButton playing={playback.playing} onToggle={playback.toggle} /> : null}
            </div>
        </article>
    );
}
