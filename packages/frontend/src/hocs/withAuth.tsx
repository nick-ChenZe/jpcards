import {useSession} from '@/lib/auth';
import {ComponentType, useEffect, useState} from 'react';
import {Navigate, useLocation} from 'react-router-dom';

/**
 * HOC：当用户未登录时重定向到 /login
 */
export function withAuth<P extends object> (WrappedComponent: ComponentType<P>) {
    return function AuthGuard(props: P) {
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

        return <WrappedComponent {...props} />;
    };
}
