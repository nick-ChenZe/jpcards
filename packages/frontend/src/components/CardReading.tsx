export function CardReading ({
    reading,
    parts,
    activeIndex = null,
    tone = 'line'
}: {
    reading?: string;
    parts?: {parts: string[]; suffix: string;} | null;
    activeIndex?: number | null;
    /** onArt：假名贴在画幅 scrim 上，不再加「读音」标签。 */
    tone?: 'line' | 'onArt';
}) {
    const onArt = tone === 'onArt';
    if (reading && parts && parts.parts.length > 0) {
        return (
            <p className={onArt ? 'jp-reading' : 'text-sm leading-6 text-foreground'}>
                {onArt ? null : <span className="mr-2 text-muted-foreground">读音</span>}
                <span className="font-japanese font-medium">
                    {parts.parts.map((text, index) => (
                        <span key={index} className={index === activeIndex ? 'mora-token-active' : undefined}>
                            {text}
                        </span>
                    ))}
                    {parts.suffix}
                </span>
            </p>
        );
    }
    if (reading) {
        return (
            <p className={onArt ? 'jp-reading' : 'text-sm leading-6 text-foreground'}>
                {onArt ? null : <span className="mr-2 text-muted-foreground">读音</span>}
                <span className="font-japanese font-medium">{reading}</span>
            </p>
        );
    }
    if (onArt) {
        return null;
    }
    return <p className="text-sm text-muted-foreground">读音这次没生成</p>;
}
