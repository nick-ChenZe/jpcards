import {Loader2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button} from '../ui/button';
import {Card, CardContent} from '../ui/card';

interface CardDetail {
    id: string;
    sentence: string;
    sentenceHtml: string;
    gloss: string;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
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
                    setError(requestError instanceof Error ? requestError.message : 'Unknown error');
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
                                {card.gloss
                                    ? <p className="text-sm text-muted-foreground">{card.gloss}</p>
                                    : null}
                                <p className="text-xs text-muted-foreground">{card.level}</p>
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
                                            配图未配置
                                        </p>
                                    )}
                                {card.audioUrl
                                    ? (
                                        <audio controls src={card.audioUrl} className="w-full max-w-xl">
                                            您的浏览器不支持音频播放。
                                        </audio>
                                    )
                                    : <p className="text-sm text-muted-foreground">语音未配置</p>}
                            </CardContent>
                        </Card>
                    )
                    : null}
            </div>
        </div>
    );
};
