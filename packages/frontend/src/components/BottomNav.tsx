import {useLocation, useNavigate} from 'react-router-dom';

const navItems = [
    {label: '今日', path: '/explore', mark: '◈'},
    {label: '日签墙', path: '/history', mark: '▤'},
    {label: '好友', path: '/friend', mark: '縁'},
    {label: '我的', path: '/setting', mark: '⚙︎'}
];

export const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <nav className="hiyori-nav" aria-label="底部导航">
            <div className="hiyori-nav-inner">
                {navItems.map((item) => {
                    const active = location.pathname === item.path
                        || (item.path === '/explore' && location.pathname === '/')
                        || (item.path === '/history' && location.pathname.startsWith('/history/'));
                    return (
                        <button
                            key={item.path}
                            type="button"
                            className={`hiyori-nav-item${item.path === '/setting' ? ' is-settings' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => navigate(item.path)}
                        >
                            <span className="hiyori-nav-mark" aria-hidden="true">{item.mark}</span>
                            <span className="hiyori-nav-label">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
