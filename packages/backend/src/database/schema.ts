import {sql} from 'drizzle-orm';
import {index, integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core';

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

export const cardHistory = sqliteTable('card_history', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sentence: text('sentence').notNull(),
    sentenceHtml: text('sentence_html').notNull(),
    audioUrl: text('audio_url'),
    illustrationUrl: text('illustration_url'),
    level: text('level').default('N5'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
    index('idx_card_history_user_created').on(table.userId, table.createdAt)
]);
