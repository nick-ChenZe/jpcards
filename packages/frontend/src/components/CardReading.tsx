export function CardReading ({reading}: {reading?: string;}) {
    if (reading) {
        return (
            <p className="text-sm leading-6 text-foreground">
                <span className="mr-2 text-muted-foreground">读音</span>
                <span className="font-medium">{reading}</span>
            </p>
        );
    }
    return <p className="text-sm text-muted-foreground">读音这次没生成</p>;
}
