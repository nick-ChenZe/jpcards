import {useSession} from '@/lib/auth';
import {Navigate, Outlet, useLocation} from 'react-router-dom';
import {BottomNav} from './BottomNav';
import {PaperHeader} from './PaperHeader';

/**
 * 认证布局：包含底部导航栏，未登录时重定向到 /login
 */
export const AuthLayout = () => {
    const {data: session, isPending} = useSession();
    const location = useLocation();

    if (isPending) {
        return (
            <div className="hiyori-loading">
                <span className="hiyori-loading-seal" role="status" aria-label="正在翻开日和">和</span>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{from: location}} replace />;
    }

    return (
        <div className="app-paper hiyori-app">
            <PaperHeader initial={(session.user.name || session.user.email || '和').slice(0, 1).toUpperCase()} />
            <div key={location.pathname} className="paper-screen">
                <Outlet />
            </div>
            <BottomNav />
        </div>
    );
};
