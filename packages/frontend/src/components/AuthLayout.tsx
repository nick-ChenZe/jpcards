import {useSession} from '@/lib/auth';
import {Navigate, Outlet, useLocation} from 'react-router-dom';
import {BottomNav} from './BottomNav';

/**
 * 认证布局：包含底部导航栏，未登录时重定向到 /login
 */
export const AuthLayout = () => {
    const {data: session, isPending} = useSession();
    const location = useLocation();

    if (isPending) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{from: location}} replace />;
    }

    return (
        <div className="min-h-screen pb-16">
            <Outlet />
            <BottomNav />
        </div>
    );
};
