import {useAdminAccess} from '@/hooks/useAdminAccess';
import {formatShanghaiTimestamp} from '@/lib/datetime';
import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {HistoryRow} from '../HistoryRow';
import {Button} from '../ui/button';

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
    const admin = useAdminAccess();

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
            <div className="mx-auto max-w-lg">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h1 className="text-xl font-medium text-ink">学习历史</h1>
                    <div className="flex items-center gap-3">
                        {admin && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/admin/cards')}
                            >
                                全部卡片
                            </Button>
                        )}
                        {total > 0 && (
                            <span className="text-sm text-ink-muted">
                                共 {total} 张卡片
                            </span>
                        )}
                    </div>
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
                        <div className="space-y-3">
                            {items.map((item) => (
                                <HistoryRow
                                    key={item.id}
                                    sentence={item.sentence}
                                    date={formatDate(item)}
                                    thumbUrl={item.illustrationUrl}
                                    onOpen={() => navigate(`/history/${item.id}`)}
                                />
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
