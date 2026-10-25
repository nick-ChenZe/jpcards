import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const dict = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
const dest = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist/kuromoji/dict');

if (!existsSync(path.join(dict, 'base.dat.gz'))) {
    console.error('[reading] kuromoji dict missing at', dict);
    process.exit(1);
}

mkdirSync(dest, {recursive: true});
cpSync(dict, dest, {recursive: true});
console.log('[reading] staged kuromoji dict to', dest);
