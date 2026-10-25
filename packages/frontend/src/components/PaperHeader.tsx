import rizhaLogo from '@/assets/rizha-logo.svg';
import {Link} from 'react-router-dom';

export function PaperHeader ({initial}: {initial?: string;}) {
    return (
        <header className="hiyori-header">
            <Link to="/explore" className="hiyori-brand" aria-label="日札 · 今日抽签">
                <img className="rizha-header-logo" src={rizhaLogo} alt="日札" width={100} height={41} />
                <span>一日一句、日本語。</span>
            </Link>
            {initial
                ? <Link className="hiyori-avatar" to="/setting" aria-label="打开我的日札">{initial}</Link>
                : <span className="hiyori-edition" lang="ja">はじまり</span>}
        </header>
    );
}
