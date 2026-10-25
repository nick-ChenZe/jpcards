import {formatShanghaiTimestamp} from '@/lib/datetime';
import {userFacingMedia} from '@/lib/userCopy';
import {Loader2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {CardReading} from '../CardReading';
import {Button} from '../ui/button';
import {Card, CardContent} from '../ui/card';

interface CardDetail {
    id: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    reading?: string;
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
            <div className="mx-auto max-w-3xl">
                <Button variant="outline" className="mb-4" onClick={() => navigate('/history')}>
                    返回历史
                </Button>
                {loading
                    ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )
                    : error
                    ? <p className="text-sm text-red-500">{error}</p>
                    : card
                    ? (
                        <Card>
                            <CardContent className="space-y-4 p-4">
                                <div
                                    className="font-japanese text-lg font-medium leading-relaxed [&_ruby]:font-normal"
                                    dangerouslySetInnerHTML={{__html: card.sentenceHtml}}
                                />
                                <CardReading reading={card.reading} />
                                {card.gloss
                                    ? <p className="text-sm text-muted-foreground">{card.gloss}</p>
                                    : null}
                                <p className="text-xs text-muted-foreground">
                                    {card.level}
                                    {' · '}
                                    {card.createdAtText || formatShanghaiTimestamp(card.createdAt)}
                                </p>
                                {card.illustrationUrl
                                    ? (
                                        <img
                                            src={card.illustrationUrl}
                                            alt="日语句子配图"
                                            className="w-full max-w-xl rounded-lg border"
                                        />
                                    )
                                    : (
                                        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                            {userFacingMedia('image')}
                                        </p>
                                    )}
                                {card.audioUrl
                                    ? (
                                        <audio controls src={card.audioUrl} className="w-full max-w-xl">
                                            您的浏览器不支持音频播放。
                                        </audio>
                                    )
                                    : <p className="text-sm text-muted-foreground">{userFacingMedia('audio')}</p>}
                            </CardContent>
                        </Card>
                    )
                    : null}
            </div>
        </div>
    );
};
