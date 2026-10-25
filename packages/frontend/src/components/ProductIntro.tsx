import {useEffect} from 'react';

function scrollFieldIntoSheet (target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const sheet = target.closest('.auth-sheet');
    if (!(sheet instanceof HTMLElement)) {
        return;
    }
    const sheetRect = sheet.getBoundingClientRect();
    const fieldRect = target.getBoundingClientRect();
    if (fieldRect.top < sheetRect.top + 8) {
        sheet.scrollTop -= sheetRect.top - fieldRect.top + 12;
    } else if (fieldRect.bottom > sheetRect.bottom - 8) {
        sheet.scrollTop += fieldRect.bottom - sheetRect.bottom + 12;
    }
}

function syncAuthViewport () {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    if (!viewport) {
        root.style.removeProperty('--auth-vvh');
        root.style.removeProperty('--auth-vv-top');
        return;
    }
    root.style.setProperty('--auth-vvh', `${Math.round(viewport.height)}px`);
    root.style.setProperty('--auth-vv-top', `${Math.round(viewport.offsetTop)}px`);
    scrollFieldIntoSheet(document.activeElement);
}

export function ProductIntro ({children}: {children: React.ReactNode;}) {
    useEffect(() => {
        syncAuthViewport();
        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', syncAuthViewport);
        viewport?.addEventListener('scroll', syncAuthViewport);
        window.addEventListener('resize', syncAuthViewport);
        return () => {
            viewport?.removeEventListener('resize', syncAuthViewport);
            viewport?.removeEventListener('scroll', syncAuthViewport);
            window.removeEventListener('resize', syncAuthViewport);
            document.documentElement.style.removeProperty('--auth-vvh');
            document.documentElement.style.removeProperty('--auth-vv-top');
        };
    }, []);

    return (
        <div className="auth-gate">
            <section
                className="auth-sheet"
                onFocus={(event) => {
                    const target = event.target;
                    window.requestAnimationFrame(() => scrollFieldIntoSheet(target));
                }}
            >
                <header className="auth-brand">
                    <span className="auth-seal" aria-hidden="true">签</span>
                    <h1 className="auth-title">日语卡片</h1>
                    <p className="auth-breath">先看句子，再看意思。</p>
                </header>
                {children}
            </section>
        </div>
    );
}
