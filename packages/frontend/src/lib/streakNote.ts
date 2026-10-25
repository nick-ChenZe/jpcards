/**
 * 连签旁注文案。
 * 第一次还没从 /api/me 落地时返回 null：调用方只留空白，不先画「轻记一下就好」。
 * 已有读数（含刷新中的上一次）原样轻记；0 或读失败后的空值不假装有连签。
 */
export function streakChipText (days: number | null, pending: boolean): string | null {
    if (pending && days === null) {
        return null;
    }
    const count = typeof days === 'number' && Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    if (count > 0) {
        return `已连签 ${count} 天 · 轻记一下就好`;
    }
    return '轻记一下就好';
}
