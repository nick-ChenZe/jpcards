import {cn} from '@/lib/utils';
import {useEffect, useRef, useState} from 'react';

export interface DaySignTile {
    id: string;
    sentence: string;
    thumbUrl?: string | null;
    month: number;
    day: number;
    breath: string;
}

function illustrationSrc (value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function DateStamp ({month, day}: {month: number; day: number;}) {
    if (day <= 0) {
        return null;
    }
    return (
        <span className="wall-date-stamp" aria-hidden="true">
            <span className="d">{day}</span>
            <span className="m">{month}月</span>
        </span>
    );
}

export function DaySignTileButton ({tile, onOpen}: {tile: DaySignTile; onOpen: () => void;}) {
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const thumbUrl = illustrationSrc(tile.thumbUrl);

    useEffect(() => {
        setReady(false);
        setFailed(false);
    }, [thumbUrl]);

    useEffect(() => {
        const image = imageRef.current;
        if (!image?.complete) {
            return;
        }
        if (image.naturalWidth > 0) {
            setReady(true);
            return;
        }
        setFailed(true);
    }, [thumbUrl]);

    const illustrated = Boolean(thumbUrl) && !failed;

    return (
        <button
            type="button"
            className={cn('wall-tile', !illustrated && 'is-plain', !illustrated && tile.day > 0 && 'has-stamp')}
            onClick={onOpen}
        >
            {illustrated && thumbUrl
                ? (
                    <span className="wall-thumb">
                        <img
                            ref={imageRef}
                            src={thumbUrl}
                            alt=""
                            onLoad={() => setReady(true)}
                            onError={() => setFailed(true)}
                            className={cn(ready ? 'paper-fade-in' : 'opacity-0')}
                        />
                        <DateStamp month={tile.month} day={tile.day} />
                    </span>
                )
                : <DateStamp month={tile.month} day={tile.day} />}
            <span className="wall-info">
                <span lang="ja" className="wall-jp">{tile.sentence}</span>
                <span className="wall-breath">{tile.breath}</span>
            </span>
        </button>
    );
}
