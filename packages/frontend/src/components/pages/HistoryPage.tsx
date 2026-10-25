import {formatShanghaiTimestamp} from '@/lib/datetime';
import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CardReading} from '../CardReading';
import {Button} from '../ui/button';
import {Card, CardContent} from '../ui/card';

interface CardHistoryItem {
    id: string;
    userId: string;
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

interface HistoryResponse {
    items: CardHistoryItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export const HistoryPage = () => {
    const [items, setItems] = useState<CardHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const fetchHistory = useCallback(async (p: number) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/history?page=${p}&pageSize=10`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('暂时无法读取学习历史');
            }
            const data = await response.json() as HistoryResponse;
            setItems(data.items);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
            setPage(p);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            setError(/[\u4e00-\u9fff]/.test(message) ? message : '请稍后再试');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    const formatDate = (item: CardHistoryItem) => {
        return item.createdAtText || formatShanghaiTimestamp(item.createdAt);
    };

    return (
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto max-w-3xl">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold">学习历史</h1>
                    {total > 0 && (
                        <span className="text-sm text-muted-foreground">
                            共 {total} 张卡片
                        </span>
                    )}
                </div>

                {loading && items.length === 0
                    ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )
                    : error
                    ? (
                        <div className="py-10 text-center">
                            <p className="text-sm text-red-500">加载失败：{error}</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => fetchHistory(page)}
                            >
                                重试
                            </Button>
                        </div>
                    )
                    : items.length === 0
                    ? (
                        <div className="py-20 text-center">
                            <p className="text-muted-foreground">还没有学习记录</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                在探索页生成一张卡片后，句子、读音和中文意思会出现在这里。
                            </p>
                        </div>
                    )
                    : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <Card
                                    key={item.id}
                                    className="cursor-pointer overflow-hidden"
                                    onClick={() => navigate(`/history/${item.id}`)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            {/* 插图缩略图 */}
                                            {item.illustrationUrl && (
                                                <img
                                                    src={item.illustrationUrl}
                                                    alt=""
                                                    className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                {/* 句子 HTML */}
                                                <div
                                                    className="font-japanese text-base font-medium leading-relaxed [&_ruby]:font-normal"
                                                    dangerouslySetInnerHTML={{__html: item.sentenceHtml}}
                                                />
                                                <div className="mt-1">
                                                    <CardReading reading={item.reading} />
                                                </div>
                                                {item.gloss
                                                    ? <p className="mt-1 text-sm text-muted-foreground">{item.gloss}</p>
                                                    : null}
                                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{item.level}</span>
                                                    <span>{formatDate(item)}</span>
                                                    {item.audioUrl
                                                        ? null
                                                        : <span>语音暂未开通</span>}
                                                </div>
                                                {/* 音频 */}
                                                {item.audioUrl && (
                                                    <audio
                                                        controls
                                                        src={item.audioUrl}
                                                        className="mt-2 h-8 w-full max-w-sm"
                                                    >
                                                        您的浏览器不支持音频播放。
                                                    </audio>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* 分页 */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 py-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1 || loading}
                                        onClick={() => fetchHistory(page - 1)}
                                    >
                                        上一页
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        {page} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages || loading}
                                        onClick={() => fetchHistory(page + 1)}
                                    >
                                        下一页
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
};
