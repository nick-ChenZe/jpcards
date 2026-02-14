/**
 * 数据库模块入口
 * 已从 MySQL 迁移到 Cloudflare D1（通过 Drizzle ORM + sqlite-proxy）
 *
 * 数据库迁移现在由 Drizzle Kit 管理：
 *   pnpm db:push    — 将 schema 推送到 D1
 *   pnpm db:generate — 生成迁移 SQL 文件
 */

export {db} from './d1Client.js';
export type {Database} from './d1Client.js';
