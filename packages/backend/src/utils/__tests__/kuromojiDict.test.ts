import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {kuromojiAssetUrl, resetKuromojiCacheForTests} from '../kuromojiDict.js';
import {toDisplayReading} from '../romaji.js';

const require = createRequire(import.meta.url);
const dictDir = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');

describe('kuromoji dictionary loading', () => {
    beforeEach(() => {
        resetKuromojiCacheForTests();
    });

    it('points Workers at /kuromoji/dict/ instead of a file URL', () => {
        expect(kuromojiAssetUrl('https://app.example/', 'base.dat.gz')).toBe(
            'https://app.example/kuromoji/dict/base.dat.gz'
        );
    });

    it('does not use the local file dictionary on Workers when assets are missing', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const reading = await toDisplayReading('こんにちは。', {runtime: 'workers'});
            expect(reading).toBe('');
            expect(error).toHaveBeenCalledWith(
                '[reading] kuromoji failed',
                expect.objectContaining({
                    reason: 'DICT_PATH_MISSING'
                })
            );
        } finally {
            error.mockRestore();
        }
    });

    it('logs a load failure when the asset dictionary 404s', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const reading = await toDisplayReading('こんにちは。', {
                runtime: 'workers',
                assetsBaseUrl: 'https://missing.local',
                assetFetch: async () => new Response('missing', {status: 404})
            });
            expect(reading).toBe('');
            expect(error).toHaveBeenCalledWith(
                '[reading] kuromoji failed',
                expect.objectContaining({
                    reason: 'DICT_LOAD_FAILED'
                })
            );
        } finally {
            error.mockRestore();
        }
    });

    it('builds the same kana reading from asset bytes as from the local dictionary', async () => {
        const viaNode = await toDisplayReading('水を飲みます。', {runtime: 'node'});
        const viaAssets = await toDisplayReading('水を飲みます。', {
            runtime: 'workers',
            assetsBaseUrl: 'https://assets.local',
            assetFetch: async (request) => {
                const filename = new URL(request.url).pathname.split('/').pop() ?? '';
                const bytes = await readFile(path.join(dictDir, filename));
                return new Response(bytes);
            }
        });
        expect(viaNode.startsWith('みず')).toBe(true);
        expect(viaNode).toContain('（');
        expect(viaAssets).toBe(viaNode);
    });

    it('copies the dictionary into frontend dist for Worker assets', () => {
        const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
        execFileSync(process.execPath, ['scripts/stage-kuromoji.mjs'], {cwd: backend, stdio: 'pipe'});
        const dest = path.resolve(backend, '../frontend/dist/kuromoji/dict/base.dat.gz');
        expect(
            dest.endsWith(
                `${path.sep}packages${path.sep}frontend${path.sep}dist${path.sep}kuromoji${path.sep}dict${path.sep}base.dat.gz`
            )
        )
            .toBe(true);
        expect(existsSync(dest)).toBe(true);
    });
});
