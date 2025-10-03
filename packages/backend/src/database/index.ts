import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { config } from '../config/index.js';

// 会话表结构
const CREATE_CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

// 消息表结构
const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
)`;

// 打开数据库连接
export function openDb(): Promise<Database> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(config.env.databasePath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(db);
        });
    });
}

// 初始化数据库表
export async function initializeDb(): Promise<void> {
    const db = await openDb();
    
    await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
            // 创建会话表
            db.run(CREATE_CONVERSATIONS_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });
            
            // 创建消息表
            db.run(CREATE_MESSAGES_TABLE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    });
    
    await new Promise<void>((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// 保存消息
export async function saveMessage(message: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    tokenCount: number;
    status?: string;
}): Promise<void> {
    const db = await openDb();
    
    try {
        await new Promise<void>((resolve, reject) => {
            // 确保会话存在
            db.run(
                'INSERT OR IGNORE INTO conversations (id) VALUES (?)',
                [message.conversationId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // 保存消息
                    db.run(
                        `INSERT INTO messages (id, conversation_id, role, content, token_count, status)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            message.id,
                            message.conversationId,
                            message.role,
                            message.content,
                            message.tokenCount,
                            message.status || 'completed'
                        ],
                        (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve();
                        }
                    );
                }
            );
        });
        
        // 更新会话的最后修改时间
        await new Promise<void>((resolve, reject) => {
            db.run(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [message.conversationId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    } finally {
        await new Promise<void>((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

// 加载会话历史消息（按 token 预算返回最新的消息）
export async function loadConversationHistory(
    conversationId: string,
    tokenBudget: number = 8000
): Promise<Array<{
    role: string;
    content: string;
    tokenCount: number;
}>> {
    const db = await openDb();
    
    try {
        return await new Promise((resolve, reject) => {
            db.all(
                `WITH RECURSIVE
                 message_tokens AS (
                     SELECT id, role, content, token_count,
                            token_count as running_total,
                            1 as message_rank
                     FROM messages
                     WHERE conversation_id = ? AND status = 'completed'
                     ORDER BY created_at DESC
                     LIMIT 1
                     
                     UNION ALL
                     
                     SELECT m.id, m.role, m.content, m.token_count,
                            mt.running_total + m.token_count,
                            mt.message_rank + 1
                     FROM messages m, message_tokens mt
                     WHERE m.conversation_id = ?
                           AND m.status = 'completed'
                           AND m.created_at < (
                               SELECT created_at
                               FROM messages
                               WHERE id = mt.id
                           )
                           AND mt.running_total + m.token_count <= ?
                     ORDER BY m.created_at DESC
                     LIMIT 1
                 )
                 SELECT role, content, token_count
                 FROM message_tokens
                 ORDER BY message_rank DESC`,
                [conversationId, conversationId, tokenBudget],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows.map((row: any) => ({
                        role: row.role,
                        content: row.content,
                        tokenCount: row.token_count
                    })));
                }
            );
        });
    } finally {
        await new Promise<void>((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}