import {authClient, useSession} from '@/lib/auth';
import {chineseAuthError} from '@/lib/authErrors';
import {paperNavigation} from '@/lib/paperNavigation';
import {cn} from '@/lib/utils';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';

export function LoginForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const navigate = useNavigate();
    const {data: session, refetch: refetchSession} = useSession();
    const location = useLocation();
    const requested = (location.state as {from?: {pathname: string;};})?.from?.pathname ?? '/explore';
    const next = requested.startsWith('/') && !requested.startsWith('//')
            && requested !== '/login'
            && requested !== '/sign-up'
        ? requested
        : '/explore';
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [opening, setOpening] = useState(false);
    const [readyUserId, setReadyUserId] = useState<string | null>(null);
    const transitioning = useRef(false);

    useEffect(() => {
        if (!readyUserId || transitioning.current) return;
        if (session?.user.id !== readyUserId) {
            const timeout = window.setTimeout(() => {
                setReadyUserId(null);
                setOpening(false);
                setSubmitting(false);
                setFormError('会话暂时没有准备好，请再试一次。');
            }, 8000);
            return () => window.clearTimeout(timeout);
        }
        let cancelled = false;
        // Wait for React's shared session to settle before the route guard mounts.
        queueMicrotask(() => {
            if (cancelled) return;
            transitioning.current = true;
            void paperNavigation(() => navigate(next, {replace: true})).catch(() => {
                navigate(next, {replace: true});
            }).finally(() => {
                setSubmitting(false);
                setOpening(false);
            });
        });
        return () => {
            cancelled = true;
        };
    }, [navigate, next, readyUserId, session?.user.id]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (submitting) {
                return;
            }
            const data = new FormData(e.currentTarget);
            setSubmitting(true);
            setFormError('');
            let authenticated = false;
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
                const result = await authClient.getSession();
                if (!result.data?.user) throw new Error('Session unavailable');
                setShowPassword(false);
                setOpening(true);
                setReadyUserId(result.data.user.id);
                refetchSession();
                authenticated = true;
            } catch {
                const message = '登录没有成功，请稍后再试。';
                setFormError(message);
                toast.error('登录没有成功', {description: message});
            } finally {
                if (!authenticated) setSubmitting(false);
            }
        },
        [refetchSession, submitting]
    );

    return (
        <div className={cn(className)} {...props}>
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="username">
                        用户名 <span>お名前</span>
                    </label>
                    <input
                        id="username"
                        name="username"
                        placeholder="请输入用户名"
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="password">
                        密码 <span>パスワード</span>
                    </label>
                    <div className="auth-password">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            placeholder="请输入密码"
                        />
                        <button
                            type="button"
                            className="auth-password-toggle"
                            aria-label={showPassword ? '隐藏密码' : '显示密码'}
                            aria-pressed={showPassword}
                            disabled={submitting}
                            onClick={() => setShowPassword((value) => !value)}
                        >
                            {showPassword ? '隐藏' : '显示'}
                        </button>
                    </div>
                </div>
                {formError
                    ? <p className="auth-error" role="alert">{formError}</p>
                    : null}
                <button type="submit" className="auth-submit" disabled={submitting}>
                    <span>{opening ? '正在翻开今日…' : submitting ? '登录中…' : '登录，开启今日'}</span>
                    <span aria-hidden="true">↗</span>
                </button>
                <p className="auth-switch">
                    还没有账号？ <Link to="/sign-up">去注册</Link>
                </p>
            </form>
        </div>
    );
}
