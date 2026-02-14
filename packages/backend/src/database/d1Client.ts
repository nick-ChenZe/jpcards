import {drizzle} from 'drizzle-orm/sqlite-proxy';
import {config} from '../config/index.js';
import * as schema from './schema.js';

const D1_API_BASE =
    `https://api.cloudflare.com/client/v4/accounts/${config.env.cloudflareAccountId}/d1/database/${config.env.d1DatabaseId}`;

interface D1ApiResponse {
    result: Array<{
        results: Array<Record<string, unknown>>;
        success: boolean;
        meta: Record<string, unknown>;
    }>;
    success: boolean;
    errors: unknown[];
}

async function d1Fetch (sql: string, params: unknown[] = []): Promise<D1ApiResponse['result'][0]> {
    const res = await fetch(`${D1_API_BASE}/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.env.cloudflareToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({sql, params})
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`D1 HTTP error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as D1ApiResponse;

    if (!json.success) {
        throw new Error(`D1 query error: ${JSON.stringify(json.errors)}`);
    }

    return json.result[0];
}

/**
 * sqlite-proxy 回调函数
 * 将 Drizzle ORM 的查询转发到 Cloudflare D1 REST API
 */
async function queryCallback (
    sql: string,
    params: unknown[],
    method: 'run' | 'all' | 'values' | 'get'
): Promise<{rows: unknown[][] | unknown[];}> {
    const result = await d1Fetch(sql, params);
    const rows = result.results || [];

    if (method === 'run') {
        return {rows: []};
    }

    if (method === 'get') {
        if (rows.length === 0) {
            return {rows: []};
        }
        return {rows: Object.values(rows[0])};
    }

    // 'all' 和 'values'
    return {rows: rows.map((row) => Object.values(row))};
}

export const db = drizzle(queryCallback, {schema});

export type Database = typeof db;
