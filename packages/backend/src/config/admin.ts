/**
 * 管理员 userId 白名单。只从 Worker secret 或本机 `.dev.vars` 的 `ADMIN_USER_IDS` 读取。
 * 英文逗号分隔，去掉两端空白，忽略空段。大小写按原样比较。
 * 未设置或为空时，没有任何管理员。
 */
export function adminUserIdAllowlist (raw: string | undefined): Set<string> {
    const allow = new Set<string>();
    for (const part of (raw ?? '').split(',')) {
        const userId = part.trim();
        if (userId) {
            allow.add(userId);
        }
    }
    return allow;
}

export function isAdminUserId (allowlistRaw: string | undefined, userId: string | null | undefined): boolean {
    if (!userId) {
        return false;
    }
    const normalized = userId.trim();
    if (!normalized) {
        return false;
    }
    return adminUserIdAllowlist(allowlistRaw).has(normalized);
}
