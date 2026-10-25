import {sql} from 'drizzle-orm';
import {index, integer, primaryKey, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core';

// ─── better-auth 认证表 ────────────────────────────────────

export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', {mode: 'boolean'}).notNull(),
    image: text('image'),
    createdAt: integer('createdAt', {mode: 'timestamp'}).notNull(),
    updatedAt: integer('updatedAt', {mode: 'timestamp'}).notNull(),
    username: text('username').unique(),
    displayUsername: text('displayUsername')
});

export const session = sqliteTable('session', {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt', {mode: 'timestamp'}).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt', {mode: 'timestamp'}).notNull(),
    updatedAt: integer('updatedAt', {mode: 'timestamp'}).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId').notNull().references(() => user.id, {onDelete: 'cascade'})
});

export const account = sqliteTable('account', {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId').notNull().references(() => user.id, {onDelete: 'cascade'}),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', {mode: 'timestamp'}),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {mode: 'timestamp'}),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt', {mode: 'timestamp'}).notNull(),
    updatedAt: integer('updatedAt', {mode: 'timestamp'}).notNull()
});

export const verification = sqliteTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', {mode: 'timestamp'}).notNull(),
    createdAt: integer('createdAt', {mode: 'timestamp'}),
    updatedAt: integer('updatedAt', {mode: 'timestamp'})
});

// ─── 应用数据表 ──────────────────────────────────────────

export const sentenceMemory = sqliteTable('sentence_memory', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sentence: text('sentence').notNull(),
    sentenceHash: text('sentence_hash').notNull(),
    level: text('level').default('N5'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
    uniqueIndex('uk_user_sentence').on(table.userId, table.sentenceHash),
    index('idx_sentence_memory_user_created').on(table.userId, table.createdAt)
]);

/** 每个用户一行：当天已生成次数，以及上一次点「生成」的时间。 */
export const dailyCardQuota = sqliteTable('daily_card_quota', {
    userId: text('user_id').primaryKey(),
    dayKey: text('day_key').notNull(),
    used: integer('used').notNull().default(0),
    lastGeneratedAt: integer('last_generated_at').notNull().default(0)
});

/** 一次抽签一把钥匙。同一把钥匙的重试不能再次预扣。 */
export const cardGenerationIdempotency = sqliteTable('card_generation_idempotency', {
    userId: text('user_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    state: text('state').notNull(),
    httpStatus: integer('http_status'),
    responseJson: text('response_json'),
    createdAt: integer('created_at').notNull()
}, (table) => [
    primaryKey({columns: [table.userId, table.idempotencyKey]})
]);

/** 注册短窗。同一 IP、同一邮箱各一行，过期后由下次注册清掉。 */
export const registerRateLimit = sqliteTable('register_rate_limit', {
    scope: text('scope').notNull(),
    bucketKey: text('bucket_key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0)
}, (table) => [
    primaryKey({columns: [table.scope, table.bucketKey]})
]);

export const cardHistory = sqliteTable('card_history', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sentence: text('sentence').notNull(),
    sentenceHtml: text('sentence_html').notNull(),
    gloss: text('gloss').notNull().default(''),
    reading: text('reading').notNull().default(''),
    /** JSON：[{surface, reading?, moraWeight}]。旧行和分词失败为 null。 */
    readingTokens: text('reading_tokens'),
    audioUrl: text('audio_url'),
    illustrationUrl: text('illustration_url'),
    level: text('level').default('N5'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
    index('idx_card_history_user_created').on(table.userId, table.createdAt)
]);
