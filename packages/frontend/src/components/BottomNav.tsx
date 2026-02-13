import {Compass, Clock, Users, Settings} from 'lucide-react';
import {useLocation, useNavigate} from 'react-router-dom';
import {cn} from '@/lib/utils';

interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{className?: string}>;
}

const navItems: NavItem[] = [
    {label: '探索', path: '/explore', icon: Compass},
    {label: '历史', path: '/history', icon: Clock},
    {label: '好友', path: '/friend', icon: Users},
    {label: '设置', path: '/setting', icon: Settings}
];

export const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                        || (item.path === '/explore' && location.pathname === '/');
                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors border-0 bg-transparent',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
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
