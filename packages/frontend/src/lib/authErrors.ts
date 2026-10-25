interface AuthErrorLike {
    code?: string;
    message?: string;
}

const COPY_BY_CODE: Record<string, string> = {
    INVALID_USERNAME_OR_PASSWORD: '用户名或密码不正确',
    INVALID_EMAIL_OR_PASSWORD: '用户名或密码不正确',
    INVALID_EMAIL: '请填写有效的邮箱',
    INVALID_PASSWORD: '密码不正确',
    PASSWORD_TOO_SHORT: '密码至少 8 位',
    PASSWORD_TOO_LONG: '密码太长了',
    USER_ALREADY_EXISTS: '这个邮箱已经注册过了',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '这个邮箱已经注册过了',
    USERNAME_IS_ALREADY_TAKEN: '这个用户名已经被使用',
    USERNAME_TOO_SHORT: '用户名至少 3 位',
    USERNAME_TOO_LONG: '用户名太长了',
    INVALID_USERNAME: '用户名只能使用字母、数字、下划线或点',
    EMAIL_NOT_VERIFIED: '邮箱还没有验证',
    FAILED_TO_CREATE_USER: '注册没有成功，请稍后再试',
    EMAIL_PASSWORD_SIGN_UP_DISABLED: '暂时不能注册',
    REGISTER_RATE_LIMITED: '注册太频繁，请稍后再试。'
};

const COPY_BY_MESSAGE: Array<[RegExp, string]> = [
    [/already exists|already taken|another email/i, '这个账号已经注册过了'],
    [/invalid username or password|invalid email or password|invalid credentials/i, '用户名或密码不正确'],
    [/password is too short|password too short/i, '密码至少 8 位'],
    [/username is too short/i, '用户名至少 3 位'],
    [/username is invalid|invalid username/i, '用户名只能使用字母、数字、下划线或点'],
    [/invalid email/i, '请填写有效的邮箱']
];

/** 登录和注册只展示中文。认不出的英文错误用兜底句，不原样抛给用户。 */
export function chineseAuthError (error: AuthErrorLike | null | undefined, fallback: string): string {
    const code = error?.code ?? '';
    if (code && COPY_BY_CODE[code]) {
        return COPY_BY_CODE[code];
    }
    const message = error?.message?.trim() ?? '';
    if (message && /[\u4e00-\u9fff]/.test(message)) {
        return message;
    }
    for (const [pattern, copy] of COPY_BY_MESSAGE) {
        if (pattern.test(message)) {
            return copy;
        }
    }
    return fallback;
}
