import {afterEach, describe, expect, it, vi} from 'vitest';
import {paperNavigation} from '../../../../frontend/src/lib/paperNavigation';
import {applyPaperTheme, readPaperTheme} from '../../../../frontend/src/lib/paperTheme';

afterEach(() => vi.unstubAllGlobals());

describe('paper navigation', () => {
    it('navigates without requiring a browser transition API', async () => {
        vi.stubGlobal('document', {});
        const navigate = vi.fn();
        await paperNavigation(navigate);
        expect(navigate).toHaveBeenCalledOnce();
    });

    it('removes credential controls from the fallback copy and cleans up after navigation', async () => {
        const blank = {style: {}};
        const input = {closest: () => null, replaceWith: vi.fn()};
        const animation = {finished: Promise.resolve(), cancel: vi.fn()};
        const snapshot = {
            dataset: {},
            style: {},
            inert: false,
            scrollTop: 0,
            setAttribute: vi.fn(),
            removeAttribute: vi.fn(),
            remove: vi.fn(),
            querySelectorAll: (selector: string) => selector === 'input' ? [input] : [],
            animate: vi.fn(() => animation)
        };
        const source = {
            animate: vi.fn(),
            scrollTop: 0,
            cloneNode: () => snapshot,
            getBoundingClientRect: () => ({top: 0, left: 0, width: 390, height: 844})
        };
        const destination = {inert: false, children: []};
        vi.stubGlobal('document', {
            body: {append: vi.fn()},
            createElement: () => blank,
            querySelector: (selector: string) => selector.includes(':not') ? destination : source
        });
        vi.stubGlobal('window', {matchMedia: () => ({matches: false})});
        const navigate = vi.fn();
        await paperNavigation(navigate);
        expect(navigate).toHaveBeenCalledOnce();
        expect(input.replaceWith).toHaveBeenCalledWith(blank);
        expect(snapshot.inert).toBe(true);
        expect(snapshot.remove).toHaveBeenCalledOnce();
        expect(animation.cancel).toHaveBeenCalledOnce();
        expect(destination.inert).toBe(false);
    });

    it('honors reduced motion without waiting for an animation', async () => {
        const start = vi.fn();
        vi.stubGlobal('document', {startViewTransition: start});
        vi.stubGlobal('window', {matchMedia: () => ({matches: true})});
        const navigate = vi.fn();
        await paperNavigation(navigate);
        expect(navigate).toHaveBeenCalledOnce();
        expect(start).not.toHaveBeenCalled();
    });

    it('keeps navigation successful when the browser skips its animation', async () => {
        const start = vi.fn((update: () => void) => {
            update();
            return {finished: Promise.reject(new Error('Animation skipped'))};
        });
        vi.stubGlobal('document', {startViewTransition: start});
        vi.stubGlobal('window', {matchMedia: () => ({matches: false})});
        const navigate = vi.fn();
        await expect(paperNavigation(navigate)).resolves.toBeUndefined();
        expect(navigate).toHaveBeenCalledOnce();
        expect(start).toHaveBeenCalledOnce();
    });
});

describe('paper color preference', () => {
    it('defaults an unknown saved color to vermillion', () => {
        vi.stubGlobal('localStorage', {getItem: () => 'unexpected'});
        expect(readPaperTheme()).toBe('vermillion');
    });

    it('remains usable when the browser blocks persistent storage', () => {
        const dataset: Record<string, string> = {};
        vi.stubGlobal('document', {documentElement: {dataset}});
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('Storage blocked');
            },
            setItem: () => {
                throw new Error('Storage blocked');
            }
        });
        expect(readPaperTheme()).toBe('vermillion');
        expect(() => applyPaperTheme('tea')).not.toThrow();
        expect(dataset.paperTheme).toBe('tea');
    });
});
