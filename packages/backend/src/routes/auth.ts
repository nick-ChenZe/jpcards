import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../database/schema.js';
import type {Env} from '../types.js';

export const auth = (env: Env) => {
    return betterAuth({
        database: drizzleAdapter(drizzle(env.DB, {schema}), {
            provider: 'sqlite',
            schema
        }),
        emailAndPassword: {
            enabled: true
        },
        trustedOrigins: ['http://localhost:5173'],
        plugins: [
            username()
        ]
    });
};
