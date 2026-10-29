import {formatShanghaiTimestamp, parseShanghaiDayKey} from '@/lib/datetime';
import {userFacingMedia} from '@/lib/userCopy';
import {useEffect, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {TodayCard} from '../TodayCard';

interface CardDetail {
    id: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    reading?: string;
    readingTokens?: unknown;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
    createdAtText?: string;
}

export const HistoryDetailPage = () => {
    const {id} = useParams();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const day = parseShanghaiDayKey(params.get('day') ?? '');
    const back = day ? `/history?day=${day}&page=${params.get('page') || '1'}` : '/history';
    const [card, setCard] = useState<CardDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) {
            setError('找不到这张卡片。');
            setLoading(false);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`/api/history/${id}`, {credentials: 'include'});
                const body = await response.json().catch(() => null) as (CardDetail & {message?: string;}) | null;
                if (!response.ok) {
                    throw new Error(body?.message || '找不到这张卡片。');
                }
                if (!cancelled && body) {
                    setCard(body);
                }
            } catch (requestError) {
                if (!cancelled) {
                    const message = requestError instanceof Error ? requestError.message : '';
                    setError(/[\u4e00-\u9fff]/.test(message) ? message : '暂时无法读取这张卡片。');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <div className="history-screen history-detail-screen">
            <div className="detail-layout">
                <div className="detail-topbar">
                    <button type="button" className="back-btn" aria-label="返回" onClick={() => navigate(back)}>
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <span className="title">日签详情</span>
                </div>
                {loading
                    ? <p className="history-detail-loading" role="status">正在翻开这张日签…</p>
                    : error
                    ? <p className="text-sm text-red-500">{error}</p>
                    : card
                    ? (
                        <TodayCard
                            sentenceHtml={card.sentenceHtml}
                            reading={card.reading}
                            readingTokens={card.readingTokens}
                            gloss={card.gloss}
                            imageUrl={card.illustrationUrl}
                            imageMessage={userFacingMedia('image')}
                            audioUrl={card.audioUrl}
                            meta={`${card.level} · ${card.createdAtText || formatShanghaiTimestamp(card.createdAt)}`}
                        />
                    )
                    : null}
                {card && !error && !loading && (
                    <button
                        type="button"
                        className="rz-history-share"
                        onClick={() => navigate(`/friend?share=${encodeURIComponent(card.id)}`)}
                    >
                        把这张日签寄给好友 ↗
                    </button>
                )}
            </div>
        </div>
    );
};
