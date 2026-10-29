import rizhaLogo from '@/assets/rizha-logo.svg';
import {Mail} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useOptionalSocial} from './social/SocialProvider';

export function PaperHeader ({initial}: {initial?: string;}) {
    const social = useOptionalSocial();
    const unread = social?.overview?.summary.total || 0;
    return (
        <header className="hiyori-header">
            <Link to="/explore" className="hiyori-brand" aria-label="日札 · 今日抽签">
                <img className="rizha-header-logo" src={rizhaLogo} alt="日札" width={100} height={41} />
                <span>一日一句、日本語。</span>
            </Link>
            <div className="rz-header-actions">
                {social && (
                    <Link
                        className="rz-header-mail"
                        to="/friend/inbox"
                        aria-label={`来信${unread ? `，${unread}条待看` : ''}`}
                    >
                        <Mail size={19} strokeWidth={1.4} />
                        {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
                    </Link>
                )}
                {initial
                    ? <Link className="hiyori-avatar" to="/setting" aria-label="打开我的日札">{initial}</Link>
                    : <span className="hiyori-edition" lang="ja">はじまり</span>}
            </div>
        </header>
    );
}
