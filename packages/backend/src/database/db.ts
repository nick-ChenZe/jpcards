import {AnyD1Database, drizzle} from 'drizzle-orm/d1';
import * as schema from './schema.js';

export function createDb (d1: AnyD1Database) {
    return drizzle(d1, {schema});
}

export type AppDatabase = ReturnType<typeof createDb>;
