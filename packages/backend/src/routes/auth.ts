import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../database/schema.js';
import type {Env} from '../types.js';

const PUBLIC_DEFAULT_SECRET = 'better-auth-secret-123456789';

export class AuthConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthConfigError';
    }
}

export function assertAuthSecret (secret: string | undefined): string {
    const value = secret?.trim() ?? '';
    if (!value || value === PUBLIC_DEFAULT_SECRET) {
        throw new AuthConfigError('BETTER_AUTH_SECRET is not configured');
    }
    return value;
}

export function resolveAuthUrls (env: Env, requestUrl: string): {baseURL: string; trustedOrigins: string[];} {
    const request = new URL(requestUrl);
    const requestOrigin = request.origin;
    const configured = env.BETTER_AUTH_URL?.trim();
    const baseURL = configured || requestOrigin;
    const extras = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const origins = new Set<string>([new URL(baseURL).origin, requestOrigin, ...extras]);

    if (request.hostname === 'localhost' || request.hostname === '127.0.0.1') {
        origins.add('http://localhost:5173');
        origins.add('http://127.0.0.1:5173');
        origins.add('http://localhost:8787');
        origins.add('http://127.0.0.1:8787');
    }

    return {baseURL, trustedOrigins: [...origins]};
}

export const auth = (env: Env, requestUrl: string) => {
    const secret = assertAuthSecret(env.BETTER_AUTH_SECRET);
    const {baseURL, trustedOrigins} = resolveAuthUrls(env, requestUrl);
    const secure = new URL(baseURL).protocol === 'https:';

    return betterAuth({
        secret,
        baseURL,
        trustedOrigins,
        database: drizzleAdapter(drizzle(env.DB, {schema}), {
            provider: 'sqlite',
            schema
        }),
        emailAndPassword: {
            enabled: true
        },
        advanced: {
            useSecureCookies: secure,
            defaultCookieAttributes: {
                sameSite: 'lax',
                httpOnly: true,
                secure
            }
        },
        plugins: [
            username()
        ]
    });
};
