import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {PaperHeader} from './PaperHeader';
import {PaperMotif} from './PaperMotif';

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
    const signingUp = useLocation().pathname === '/sign-up';
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
                className={`auth-sheet app-paper hiyori-auth ${signingUp ? 'is-signup' : ''}`}
                onFocus={(event) => {
                    const target = event.target;
                    window.requestAnimationFrame(() => scrollFieldIntoSheet(target));
                }}
            >
                <PaperHeader />
                <div className="auth-content">
                    <PaperMotif kind="login" />
                    <div className="hiyori-auth-welcome">
                        <span className="hiyori-kicker">A LITTLE EVERY DAY</span>
                        <h1>{signingUp ? '把日语，收进日常。' : '新的一页，从这里开始。'}</h1>
                        <p>{signingUp ? '从今天起，为自己留下一句日语。' : '登录日札，收下今天的第一句日语。'}</p>
                    </div>
                    {children}
                    <p className="hiyori-endnote">一期一会，一日一句。</p>
                </div>
                <footer className="hiyori-footer">
                    <span>日札</span>
                    <span>让日语，慢慢成为日常。</span>
                </footer>
            </section>
        </div>
    );
}
