import {flushSync} from 'react-dom';

async function waitForDestination (): Promise<HTMLElement | null> {
    const deadline = performance.now() + 1600;
    while (performance.now() < deadline) {
        const paper = document.querySelector<HTMLElement>('.app-paper:not([data-paper-snapshot])');
        if (paper) return paper;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return null;
}

/** WebKit without View Transitions gets the same turn inside a temporary, inert paper layer. */
async function animatePaperFallback (navigate: () => void) {
    const source = document.querySelector?.('.app-paper') as HTMLElement | null | undefined;
    if (!source || !source.animate) {
        navigate();
        return;
    }
    const rect = source.getBoundingClientRect();
    const snapshot = source.cloneNode(true) as HTMLElement;
    snapshot.dataset.paperSnapshot = '';
    snapshot.inert = true;
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.removeAttribute('id');
    snapshot.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    // Do not leave entered credentials in the transient visual copy.
    snapshot.querySelectorAll('input').forEach((input) => {
        const blank = document.createElement('span');
        Object.assign(blank.style, {
            display: 'block',
            height: '44px',
            width: '100%',
            borderBottom: input.closest('.auth-password') ? 'none' : '1px solid var(--paper-edge)'
        });
        input.replaceWith(blank);
    });
    Object.assign(snapshot.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        maxHeight: 'none',
        margin: '0',
        zIndex: '9999',
        overflow: 'hidden',
        pointerEvents: 'none',
        transformOrigin: '0 50%',
        backfaceVisibility: 'hidden',
        boxShadow: '18px 0 30px #2d281d25',
        viewTransitionName: 'none'
    });
    document.body.append(snapshot);
    snapshot.scrollTop = source.scrollTop;
    const animations: Animation[] = [];
    let destination: HTMLElement | null = null;
    try {
        flushSync(navigate);
        destination = await waitForDestination();
        if (destination) destination.inert = true;
        animations.push(snapshot.animate([
            {transform: 'perspective(1400px) rotateY(0)', opacity: 1, offset: 0},
            {transform: 'perspective(1400px) rotateY(-8deg)', opacity: 1, offset: .18},
            {transform: 'perspective(1400px) rotateY(-78deg)', opacity: 1, offset: .7},
            {transform: 'perspective(1400px) rotateY(-104deg)', opacity: 0, offset: 1}
        ], {duration: 1300, easing: 'cubic-bezier(.32,.05,.18,1)', fill: 'forwards'}));
        if (destination) {
            // Keep the fixed bottom navigation's containing block stable while revealing content.
            for (const child of destination.children) {
                if (!(child instanceof HTMLElement) || child.tagName === 'NAV') continue;
                animations.push(child.animate([
                    {transform: 'translateX(22px)', opacity: .25},
                    {transform: 'translateX(0)', opacity: 1}
                ], {duration: 1100, delay: 150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'}));
            }
        }
        await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    } finally {
        if (destination) destination.inert = false;
        animations.forEach((animation) => animation.cancel());
        snapshot.remove();
    }
}

/** Authenticate first; keep routing, session updates and the paper turn in one lifecycle. */
export async function paperNavigation (navigate: () => void): Promise<void> {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigate();
        return;
    }
    if (!document.startViewTransition) {
        await animatePaperFallback(navigate);
        return;
    }
    const transition = document.startViewTransition(() => flushSync(navigate));
    // A skipped browser animation is still a successful navigation.
    await transition.finished.catch(() => {});
}
