import {describe, expect, it} from 'vitest';
import type {Env} from '../../types.js';
import {assertAuthSecret, resolveAuthUrls} from '../auth.js';

describe('auth config', () => {
    it('rejects a missing secret and the public better-auth default', () => {
        expect(() => assertAuthSecret(undefined)).toThrow(/BETTER_AUTH_SECRET/);
        expect(() => assertAuthSecret('better-auth-secret-123456789')).toThrow(/BETTER_AUTH_SECRET/);
        expect(assertAuthSecret('local-dev-secret-with-enough-length')).toBe('local-dev-secret-with-enough-length');
    });

    it('does not trust the vite port on a public host', () => {
        const resolved = resolveAuthUrls({} as Env, 'https://jpcards.example.com/api/auth/sign-in');
        expect(resolved.baseURL).toBe('https://jpcards.example.com');
        expect(resolved.trustedOrigins).toEqual(['https://jpcards.example.com']);
    });

    it('trusts local dev origins only for localhost requests', () => {
        const resolved = resolveAuthUrls({} as Env, 'http://localhost:8787/api/auth/get-session');
        expect(resolved.trustedOrigins).toContain('http://localhost:5173');
        expect(resolved.trustedOrigins).toContain('http://localhost:8787');
    });
});
