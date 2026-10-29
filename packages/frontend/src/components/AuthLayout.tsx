import {useSession} from '@/lib/auth';
import {Navigate, Outlet, useLocation} from 'react-router-dom';
import {BottomNav} from './BottomNav';
import {PaperHeader} from './PaperHeader';
import {SealFoxMark} from './SealFox';

/**
 * 认证布局：包含底部导航栏，未登录时重定向到 /login
 */
export const AuthLayout = () => {
    const {data: session, isPending} = useSession();
    const location = useLocation();

    if (isPending) {
        return (
            <div className="hiyori-loading">
                <span className="hiyori-loading-seal" role="status" aria-label="正在翻开日札">
                    <SealFoxMark className="auth-wait-seal" />
                </span>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{from: location}} replace />;
    }

    return (
        <div className="app-paper hiyori-app">
            <PaperHeader initial={(session.user.name || session.user.email || '札').slice(0, 1).toUpperCase()} />
            <div
                key={location.pathname}
                className={`paper-screen${location.pathname.startsWith('/history') ? ' is-calendar-route' : ''}`}
            >
                <Outlet />
            </div>
            <BottomNav />
        </div>
    );
};
