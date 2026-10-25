export function ProductIntro ({children}: {children: React.ReactNode;}) {
    return (
        <div className="flex h-full w-full justify-center overflow-auto bg-background px-4 py-10">
            <div className="flex w-full max-w-md flex-col gap-8">
                <header className="space-y-3 text-center">
                    <p className="text-sm font-medium text-muted-foreground">学日语，从一张卡片开始</p>
                    <p className="text-4xl font-semibold tracking-tight text-foreground">日语卡片</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                        每天用一张卡片学日语。先看句子和读音，再看中文意思，随时在历史里复习。
                    </p>
                </header>
                {children}
            </div>
        </div>
    );
}
