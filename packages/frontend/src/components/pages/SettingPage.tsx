import rizhaMark from '@/assets/rizha-mark.svg';
import {useAdminAccess} from '@/hooks/useAdminAccess';
import {signOut, useSession} from '@/lib/auth';
import {applyPaperTheme, paperThemes, readPaperTheme} from '@/lib/paperTheme';
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {toast} from 'sonner';
import {Button} from '../ui/button';

export const SettingPage = () => {
    const navigate = useNavigate();
    const admin = useAdminAccess();
    const {data: session} = useSession();
    const [theme, setTheme] = useState(readPaperTheme);
    const [leaving, setLeaving] = useState(false);
    const handleLogout = async () => {
        if (leaving) return;
        setLeaving(true);
        try {
            const result = await signOut();
            if (result.error) throw new Error('Sign out failed');
            navigate('/login', {replace: true});
        } catch {
            toast.error('退出没有成功，请稍后再试。');
        } finally {
            setLeaving(false);
        }
    };
    return (
        <div className="hiyori-page">
            <h1 className="hiyori-page-title">我的日札</h1>
            <p className="hiyori-page-sub">{session?.user.name || '你'}，慢慢来，也是在向前。</p>
            <div className="hiyori-personal-mark" aria-hidden="true">
                <img src={rizhaMark} alt="" width={100} height={100} />
            </div>
            <fieldset className="hiyori-theme-options">
                <legend>选择一种纸上的心情</legend>
                {paperThemes.map((option) => (
                    <label key={option.id} className="hiyori-theme-option" data-tone={option.id}>
                        <input
                            type="radio"
                            name="paper-theme"
                            value={option.id}
                            checked={theme === option.id}
                            onChange={() => {
                                setTheme(option.id);
                                applyPaperTheme(option.id);
                            }}
                        />
                        <span className="hiyori-paper-swatch" aria-hidden="true" />
                        <span>
                            {option.name}
                            <small>{option.description}</small>
                        </span>
                        <span className="hiyori-theme-check" aria-hidden="true">{theme === option.id ? '✓' : ''}</span>
                    </label>
                ))}
            </fieldset>
            <div className="hiyori-setting-actions">
                {admin ? <Button variant="outline" onClick={() => navigate('/admin/cards')}>全部卡片</Button> : null}
                <Button variant="outline" onClick={handleLogout} disabled={leaving}>
                    {leaving ? '正在退出…' : '退出登录'}
                </Button>
            </div>
            <p className="hiyori-endnote">一期一会，一日一句。</p>
        </div>
    );
};
