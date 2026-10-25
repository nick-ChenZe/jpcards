import {Link} from 'react-router-dom';

export function PaperHeader ({initial}: {initial?: string;}) {
    return (
        <header className="hiyori-header">
            <Link to="/explore" className="hiyori-brand" aria-label="日和 · 今日抽签">
                日和 <span>一日一句、日本語。</span>
            </Link>
            {initial
                ? <Link className="hiyori-avatar" to="/setting" aria-label="打开我的日和">{initial}</Link>
                : <span className="hiyori-edition" lang="ja">はじまり</span>}
        </header>
    );
}
