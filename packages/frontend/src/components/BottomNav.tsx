import {cn} from '@/lib/utils';
import {Clock, Compass, Settings, Users} from 'lucide-react';
import {useLocation, useNavigate} from 'react-router-dom';

interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{className?: string;}>;
}

const navItems: NavItem[] = [
    {label: '今日', path: '/explore', icon: Compass},
    {label: '日签墙', path: '/history', icon: Clock},
    {label: '好友', path: '/friend', icon: Users},
    {label: '我的', path: '/setting', icon: Settings}
];

export const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav className="hiyori-nav">
            <div className="hiyori-nav-inner">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                        || (item.path === '/explore' && location.pathname === '/')
                        || (item.path === '/history' && location.pathname.startsWith('/history/'));
                    return (
                        <button
                            key={item.path}
                            type="button"
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors border-0 bg-transparent',
                                isActive
                                    ? 'text-seal'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
