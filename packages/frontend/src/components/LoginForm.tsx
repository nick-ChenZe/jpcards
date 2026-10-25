import {authClient} from '@/lib/auth';
import {chineseAuthError} from '@/lib/authErrors';
import {cn} from '@/lib/utils';
import {useCallback, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';

export function LoginForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const navigate = useNavigate();
    const location = useLocation();
    const requested = (location.state as {from?: {pathname: string;};})?.from?.pathname ?? '/explore';
    const next = requested.startsWith('/') && !requested.startsWith('//')
            && requested !== '/login'
            && requested !== '/sign-up'
        ? requested
        : '/explore';
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (submitting) {
                return;
            }
            const data = new FormData(e.currentTarget);
            setSubmitting(true);
            setFormError('');
            try {
                const res = await authClient.signIn.username({
                    username: String(data.get('username') ?? ''),
                    password: String(data.get('password') ?? '')
                });

                if (res.error) {
                    const message = chineseAuthError(res.error, '登录没有成功，请检查用户名和密码。');
                    setFormError(message);
                    toast.error('登录没有成功', {description: message});
                    return;
                }
                toast.success('登录成功', {description: '正在进入日语卡片'});
                navigate(next, {replace: true});
            } catch {
                const message = '登录没有成功，请稍后再试。';
                setFormError(message);
                toast.error('登录没有成功', {description: message});
            } finally {
                setSubmitting(false);
            }
        },
        [navigate, next, submitting]
    );

    return (
        <div className={cn(className)} {...props}>
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="username">用户名</label>
                    <input
                        id="username"
                        name="username"
                        placeholder="请输入用户名"
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="password">密码</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="请输入密码"
                    />
                </div>
                {formError
                    ? <p className="auth-error" role="alert">{formError}</p>
                    : null}
                <button type="submit" className="auth-submit" disabled={submitting}>
                    {submitting ? '登录中...' : '登录'}
                </button>
                <p className="auth-switch">
                    还没有账号？ <Link to="/sign-up">去注册</Link>
                </p>
            </form>
        </div>
    );
}
