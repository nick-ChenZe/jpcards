import {createPool, type Pool} from 'mysql2/promise';
import {config} from '../config/index.js';

let pool: Pool | null = null;

export function getPool (): Pool {
    if (!pool) {
        pool = createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            port: Number(process.env.MYSQL_PORT) || 3306,
            user: config.env.mysqlUser,
            password: config.env.mysqlPassword,
            database: process.env.MYSQL_DATABASE || 'db',
            timezone: 'Z'
        });
    }
    return pool;
}

async function runMigrationFile (db: Pool, migrationPath: string): Promise<void> {
    const {readFileSync} = await import('node:fs');
    const sql = readFileSync(migrationPath, 'utf8');
    const statements = sql
        .split(';')
        .map((s) => s.replace(/--.*$/gm, '').trim())
        .filter((s) => s.length > 0);
    for (const stmt of statements) {
        await db.query(stmt);
    }
}

async function tableExists (db: Pool, tableName: string): Promise<boolean> {
    const [rows] = await db.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
        [tableName]
    );
    return Array.isArray(rows) && rows.length > 0;
}

export async function runMigrations (): Promise<void> {
    const db = getPool();
    const {join, dirname} = await import('node:path');
    const {fileURLToPath} = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));

    // 001: sentence_memory
    if (!(await tableExists(db, 'sentence_memory'))) {
        const migrationPath = join(__dirname, 'sql', 'migrations', '001_sentence_memory.sql');
        await runMigrationFile(db, migrationPath);
        console.log('Migration 001_sentence_memory applied.');
    }

    // 002: card_history
    if (!(await tableExists(db, 'card_history'))) {
        const migrationPath = join(__dirname, 'sql', 'migrations', '002_card_history.sql');
        await runMigrationFile(db, migrationPath);
        console.log('Migration 002_card_history applied.');
    }
}
