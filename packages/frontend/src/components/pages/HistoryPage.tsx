import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {Button} from '../ui/button';
import {Card, CardContent} from '../ui/card';

interface CardHistoryItem {
    id: string;
    userId: string;
    sentence: string;
    sentenceHtml: string;
    audioUrl: string | null;
    illustrationUrl: string | null;
    level: string;
    createdAt: string;
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

    const fetchHistory = useCallback(async (p: number) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/history?page=${p}&pageSize=10`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const data = await response.json() as HistoryResponse;
            setItems(data.items);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
            setPage(p);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                                去「探索」页面生成你的第一张卡片吧！
                            </p>
                        </div>
                    )
                    : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <Card key={item.id} className="overflow-hidden">
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
                                                {/* 元信息 */}
                                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{item.level}</span>
                                                    <span>{formatDate(item.createdAt)}</span>
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
