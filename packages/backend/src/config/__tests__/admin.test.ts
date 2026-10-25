import {describe, expect, it} from 'vitest';
import {adminEmailAllowlist, isAdminEmail} from '../admin.js';

describe('admin email allowlist', () => {
    it('treats a missing or blank allowlist as nobody', () => {
        expect(adminEmailAllowlist(undefined).size).toBe(0);
        expect(adminEmailAllowlist('').size).toBe(0);
        expect(adminEmailAllowlist('  ,  , ').size).toBe(0);
        expect(isAdminEmail(undefined, 'owner@example.com')).toBe(false);
        expect(isAdminEmail('', 'owner@example.com')).toBe(false);
        expect(isAdminEmail('owner@example.com', '')).toBe(false);
        expect(isAdminEmail('owner@example.com', null)).toBe(false);
    });

    it('matches comma-separated emails without case or surrounding spaces', () => {
        const raw = ' Owner@Example.com , editor@example.com , ';
        expect([...adminEmailAllowlist(raw)]).toEqual(['owner@example.com', 'editor@example.com']);
        expect(isAdminEmail(raw, 'owner@example.com')).toBe(true);
        expect(isAdminEmail(raw, '  EDITOR@example.com ')).toBe(true);
        expect(isAdminEmail(raw, 'stranger@example.com')).toBe(false);
    });
});
