import {CARD_STAGES, type CardStage, generationEstimate} from '@/lib/cardProgress';
import {useEffect, useState} from 'react';

const labels = {sentence: '寻一句日语', illustration: '绘制纸上风景', finishing: '收好这一枚日签'};

export function GenerationProgress ({stage, startedAt, expected}: {
    stage: CardStage;
    startedAt: number;
    expected: number;
}) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [startedAt]);
    const index = CARD_STAGES.indexOf(stage);
    return (
        <div className="generation-progress" role="status" aria-busy="true">
            <div className="generation-wash" aria-hidden="true">
                <i />
                <i />
                <i />
            </div>
            <span className="generation-kicker">一 枚 日 签，正 在 成 形</span>
            <h2>{labels[stage]}</h2>
            <p className="generation-eta">{generationEstimate(elapsed, expected, stage)}</p>
            <ol className="generation-steps" aria-label="生成进度">
                {CARD_STAGES.map((item, i) => (
                    <li key={item} data-state={i < index ? 'done' : i === index ? 'active' : 'waiting'}>
                        <span className="generation-step-line" />
                        <span>{labels[item]}</span>
                    </li>
                ))}
            </ol>
            <div className="generation-time">
                <span>通常约 {Math.round(expected * .7)}–{Math.round(expected * 1.5)} 秒</span>
                <span>已等待 {elapsed} 秒</span>
            </div>
            <p className="generation-note">用一点时间，让颜色慢慢落在纸上。</p>
        </div>
    );
}
