/**
 * 管理员邮箱白名单。只从 Worker secret 或本机 `.dev.vars` 的 `ADMIN_EMAILS` 读取。
 * 逗号分隔，忽略大小写和两端空白。未设置或为空时，没有任何管理员。
 */
export function adminEmailAllowlist (raw: string | undefined): Set<string> {
    const allow = new Set<string>();
    for (const part of (raw ?? '').split(',')) {
        const email = part.trim().toLowerCase();
        if (email) {
            allow.add(email);
        }
    }
    return allow;
}

export function isAdminEmail (allowlistRaw: string | undefined, email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return adminEmailAllowlist(allowlistRaw).has(normalized);
}
