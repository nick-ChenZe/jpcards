export const paperThemes = [
    {id: 'vermillion', name: '朱印手帖', description: '和纸 · 朱砂 · 手帖的温度'},
    {id: 'tea', name: '抹茶文库', description: '薄绿 · 文库 · 午后的阅读'},
    {id: 'ink', name: '墨色诗笺', description: '墨黑 · 留白 · 一句一景'}
] as const;

export type PaperTheme = typeof paperThemes[number]['id'];

export function readPaperTheme (): PaperTheme {
    try {
        const saved = localStorage.getItem('jpcards-paper-theme');
        return paperThemes.find((theme) => theme.id === saved)?.id ?? 'vermillion';
    } catch {
        return 'vermillion';
    }
}

export function applyPaperTheme (theme: PaperTheme) {
    document.documentElement.dataset.paperTheme = theme;
    try {
        localStorage.setItem('jpcards-paper-theme', theme);
    } catch {
        // A blocked storage area must not prevent changing the paper color.
    }
}
