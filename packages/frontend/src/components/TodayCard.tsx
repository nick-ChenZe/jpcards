import rizhaMark from '@/assets/rizha-mark.svg';
import {parseReadingTokens, playbackTokenIndex} from '@/lib/readingHighlight';
import {cn} from '@/lib/utils';
import {Pause, Play} from 'lucide-react';
import {type ReactNode, useEffect, useRef, useState} from 'react';
import {SentenceReading} from './SentenceReading';

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
    /** hero：插画撑满舞台，句子叠在 cover 画幅底。sheet：固定 4:3 画幅，同样叠在画上。 */
    variant?: 'hero' | 'sheet';
}

function CardSkeleton ({label}: {label: string;}) {
    return (
        <div className="drawing-state" role="status" aria-live="polite" aria-busy="true">
            <p className="drawing-label">{label}</p>
            <div className="skeleton-card">
                <div className="paper-breathe skel-illust" />
                <div className="skel-body">
                    <div className="paper-breathe skel-line mid" />
                    <div className="paper-breathe paper-breathe-delay-1 skel-line short" />
                    <div className="paper-breathe paper-breathe-delay-2 skel-line tiny" />
                </div>
            </div>
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
            className={cn('play-btn', playing && 'playing')}
            aria-label={playing ? '暂停朗读' : '播放朗读'}
            aria-pressed={playing}
            onClick={onToggle}
        >
            <span className="play-pulse" />
            {playing
                ? <Pause />
                : <Play className="translate-x-px" />}
        </button>
    );
}

function GlossBlock ({gloss}: {gloss?: string;}) {
    if (!gloss) return null;
    return (
        <div className="gloss-block translation-note">
            <span className="translation-mark" aria-hidden="true">訳</span>
            <p className="gloss-text">{gloss}</p>
        </div>
    );
}

function PaintedArt ({
    url,
    children,
    onFail
}: {
    url: string;
    children: ReactNode;
    onFail: () => void;
}) {
    const [ready, setReady] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setReady(false);
    }, [url]);

    useEffect(() => {
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth > 0) {
            setReady(true);
        }
    }, [url]);

    return (
        <div className="card-illustration" data-art={ready ? 'ready' : 'loading'}>
            <div className="art-paint">
                <img
                    ref={imageRef}
                    src={url}
                    alt="日语句子配图"
                    onLoad={() => setReady(true)}
                    onError={onFail}
                    className="art-cover"
                />
                <span className="art-ink-veil" aria-hidden="true" />
                <div className="jp-on-art">{children}</div>
            </div>
        </div>
    );
}

export function TodayCard ({
    loading = false,
    loadingLabel = '抽签中…',
    sentenceHtml,
    reading,
    readingTokens,
    gloss,
    imageUrl,
    imageMessage,
    audioUrl,
    note,
    meta,
    variant = 'sheet'
}: TodayCardProps) {
    const [imageFailed, setImageFailed] = useState(false);
    const tokens = parseReadingTokens(readingTokens);
    const playback = useCardAudio(audioUrl);
    const activeIndex = playbackTokenIndex(
        tokens,
        playback.sample.currentTime,
        playback.sample.duration,
        playback.playing,
        playback.sample.ended
    );
    const painted = Boolean(imageUrl) && !imageFailed;

    useEffect(() => {
        setImageFailed(false);
    }, [imageUrl]);

    if (loading) {
        return <CardSkeleton label={loadingLabel} />;
    }

    const sentence = (
        <SentenceReading sentenceHtml={sentenceHtml} reading={reading} tokens={tokens} activeIndex={activeIndex} />
    );

    return (
        <article
            className={cn(
                'today-card',
                variant === 'hero' && 'is-hero',
                !painted && 'is-plain'
            )}
        >
            <div className="hiyori-ticket-top">
                <span>日々のことば</span>
                <span>DAILY JAPANESE</span>
            </div>
            <span className="hiyori-card-seal" aria-hidden="true">
                <img src={rizhaMark} alt="" width={34} height={34} />
            </span>
            {painted && imageUrl
                ? (
                    <PaintedArt url={imageUrl} onFail={() => setImageFailed(true)}>
                        {sentence}
                    </PaintedArt>
                )
                : null}
            <div className="card-body">
                {painted ? null : sentence}
                {!painted && imageMessage
                    ? <p className="mb-3 text-sm leading-6 text-ink-muted">{imageMessage}</p>
                    : null}
                <GlossBlock gloss={gloss} />
                {note
                    ? <p className="mb-3 text-sm leading-6 text-ink-muted">{note}</p>
                    : null}
                <div className="card-actions">
                    {audioUrl
                        ? (
                            <div className="card-listen">
                                <CardPlayButton playing={playback.playing} onToggle={playback.toggle} />
                                <span aria-hidden="true">{playback.playing ? '正在朗读' : '听一句'}</span>
                            </div>
                        )
                        : <span />}
                    {meta ? <span className="card-meta">{meta}</span> : null}
                </div>
            </div>
        </article>
    );
}
