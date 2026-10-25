/** #8 定稿。与后端 QUOTA_EXCEEDED_MESSAGE 同一句。 */
export const QUOTA_EXCEEDED_MESSAGE = '今日额度已用完，明天 0 点（北京时间）再来';

const TECHNICAL = /密钥|外部服务|未配置/;

export function userFacingMedia (kind: 'image' | 'audio', message?: string): string {
    const fallback = kind === 'image' ? '配图暂未开通' : '语音暂未开通';
    if (!message || TECHNICAL.test(message)) {
        return fallback;
    }
    return message;
}

export function userFacingTextNotice (message?: string): string {
    if (!message) {
        return '';
    }
    if (TECHNICAL.test(message)) {
        return '这是本地练习卡片，可以直接看句子、读音和中文意思。';
    }
    return message;
}
