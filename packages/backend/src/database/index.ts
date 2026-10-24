/**
 * Worker 里的学习数据走 D1 绑定（createDb）。
 * 本机 drizzle-kit 仍用开发者自己的 CLOUDFLARE_API_TOKEN，不进 Worker。
 */

export {createDb} from './db.js';
export type {AppDatabase} from './db.js';
