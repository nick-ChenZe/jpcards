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

export function DaySignTileButton ({tile, onOpen}: {tile: DaySignTile; onOpen: () => void;}) {
    const [ready, setReady] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setReady(false);
    }, [tile.thumbUrl]);

    useEffect(() => {
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth > 0) {
            setReady(true);
        }
    }, [tile.thumbUrl]);

    return (
        <button type="button" className="wall-tile" onClick={onOpen}>
            <span className="wall-thumb">
                {tile.thumbUrl
                    ? (
                        <img
                            ref={imageRef}
                            src={tile.thumbUrl}
                            alt=""
                            onLoad={() => setReady(true)}
                            className={cn(ready ? 'paper-fade-in' : 'opacity-0')}
                        />
                    )
                    : null}
                {tile.day > 0
                    ? (
                        <span className="wall-date-stamp" aria-hidden="true">
                            <span className="d">{tile.day}</span>
                            <span className="m">{tile.month}月</span>
                        </span>
                    )
                    : null}
            </span>
            <span className="wall-info">
                <span lang="ja" className="wall-jp">{tile.sentence}</span>
                <span className="wall-breath">{tile.breath}</span>
            </span>
        </button>
    );
}
