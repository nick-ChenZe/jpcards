import {describe, expect, it} from 'vitest';
import {adminUserIdAllowlist, isAdminUserId} from '../admin.js';

describe('admin user id allowlist', () => {
    it('treats a missing or blank allowlist as nobody', () => {
        expect(adminUserIdAllowlist(undefined).size).toBe(0);
        expect(adminUserIdAllowlist('').size).toBe(0);
        expect(adminUserIdAllowlist('  ,  , ').size).toBe(0);
        expect(isAdminUserId(undefined, 'user-admin')).toBe(false);
        expect(isAdminUserId('', 'user-admin')).toBe(false);
        expect(isAdminUserId('user-admin', '')).toBe(false);
        expect(isAdminUserId('user-admin', null)).toBe(false);
    });

    it('matches trimmed user ids and ignores empty segments', () => {
        const raw = ' user-admin , , user-editor , ';
        expect([...adminUserIdAllowlist(raw)]).toEqual(['user-admin', 'user-editor']);
        expect(isAdminUserId(raw, 'user-admin')).toBe(true);
        expect(isAdminUserId(raw, '  user-editor  ')).toBe(true);
        expect(isAdminUserId(raw, 'user-other')).toBe(false);
        expect(isAdminUserId(raw, 'User-Admin')).toBe(false);
        expect(isAdminUserId('admin@example.com', 'user-admin')).toBe(false);
    });
});
