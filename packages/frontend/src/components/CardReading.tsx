export function CardReading ({
    reading,
    parts,
    activeIndex = null
}: {
    reading?: string;
    parts?: {parts: string[]; suffix: string;} | null;
    activeIndex?: number | null;
}) {
    if (reading && parts && parts.parts.length > 0) {
        return (
            <p className="text-sm leading-6 text-foreground">
                <span className="mr-2 text-muted-foreground">读音</span>
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
            <p className="text-sm leading-6 text-foreground">
                <span className="mr-2 text-muted-foreground">读音</span>
                <span className="font-japanese font-medium">{reading}</span>
            </p>
        );
    }
    return <p className="text-sm text-muted-foreground">读音这次没生成</p>;
}
