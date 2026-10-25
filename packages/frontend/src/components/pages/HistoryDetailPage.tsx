import {formatShanghaiTimestamp} from '@/lib/datetime';
import {userFacingMedia} from '@/lib/userCopy';
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {TodayCard} from '../TodayCard';
import {Button} from '../ui/button';

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
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto flex max-w-lg flex-col gap-4">
                <Button variant="outline" className="self-start" onClick={() => navigate('/history')}>
                    返回历史
                </Button>
                {loading
                    ? <TodayCard loading loadingLabel="正在读取这张卡片" />
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
            </div>
        </div>
    );
};
