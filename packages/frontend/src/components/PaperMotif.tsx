import {SealFoxMark} from './SealFox';

export function PaperMotif ({kind = 'draw'}: {kind?: 'draw' | 'login';}) {
    return (
        <div className={`paper-motif is-${kind}`} aria-hidden="true">
            <span className="motif-aside" lang="ja">ことばと、暮らす。</span>
            <div className="motif-sun" />
            <div className="motif-back" />
            <div className="motif-slip">
                {kind === 'login'
                    ? (
                        <>
                            <span className="motif-caption">一 日 一 句</span>
                            <span className="motif-verse" lang="ja">
                                今日も、<br />いい日になる。
                            </span>
                            <span className="motif-seal">
                                <SealFoxMark />
                            </span>
                        </>
                    )
                    : <span className="motif-verse" lang="ja">今日の言葉</span>}
            </div>
            <div className="motif-waves" />
            <span className="motif-number">{kind === 'login' ? '序 · 001' : '一期一会'}</span>
        </div>
    );
}
