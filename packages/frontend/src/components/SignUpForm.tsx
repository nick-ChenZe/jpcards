import {authClient} from '@/lib/auth';
import {chineseAuthError} from '@/lib/authErrors';
import {cn} from '@/lib/utils';
import {useCallback, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';

export function SignUpForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (submitting) {
                return;
            }
            const data = new FormData(e.currentTarget);
            const username = String(data.get('username') ?? '');
            const password = String(data.get('password') ?? '');
            const email = String(data.get('email') ?? '');
            const name = String(data.get('name') ?? '');
            setSubmitting(true);
            setFormError('');
            try {
                const res = await authClient.signUp.email({
                    email,
                    name,
                    password,
                    username: username || undefined
                });

                if (res.error) {
                    const message = chineseAuthError(res.error, '注册没有成功，请检查填写内容。');
                    setFormError(message);
                    toast.error('注册没有成功', {description: message});
                    return;
                }

                const session = await authClient.getSession();
                if (!session.data?.user) {
                    const signIn = await authClient.signIn.username({username, password});
                    if (signIn.error) {
                        const message = '注册已完成，请登录后进入练习。';
                        setFormError(message);
                        toast.success('注册成功', {description: message});
                        navigate('/login', {replace: true});
                        return;
                    }
                }

                setDone(true);
                toast.success('注册成功', {description: '正在进入日语卡片'});
                navigate('/explore', {replace: true});
            } catch {
                const message = '注册没有成功，请稍后再试。';
                setFormError(message);
                toast.error('注册没有成功', {description: message});
            } finally {
                setSubmitting(false);
            }
        },
        [navigate, submitting]
    );

    if (done) {
        return (
            <div className={cn(className)} {...props}>
                <p className="auth-status" role="status">正在进入日语卡片…</p>
            </div>
        );
    }

    return (
        <div className={cn(className)} {...props}>
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="username">用户名</label>
                    <input
                        id="username"
                        name="username"
                        placeholder="字母、数字、下划线或点"
                        autoComplete="username"
                        required
                        minLength={3}
                    />
                    <p className="auth-hint">至少 3 位，只能使用字母、数字、下划线或点</p>
                </div>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="name">名字</label>
                    <input
                        id="name"
                        name="name"
                        placeholder="怎么称呼你"
                        autoComplete="name"
                        required
                    />
                </div>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="email">邮箱</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="请输入邮箱"
                        autoComplete="email"
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
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="至少 8 位"
                    />
                    <p className="auth-hint">至少 8 位</p>
                </div>
                {formError
                    ? <p className="auth-error" role="alert">{formError}</p>
                    : null}
                <button type="submit" className="auth-submit" disabled={submitting}>
                    {submitting ? '注册中...' : '注册'}
                </button>
                <p className="auth-switch">
                    已经有账号？ <Link to="/login">去登录</Link>
                </p>
            </form>
        </div>
    );
}
