import {formatShanghaiTimestamp} from '@/lib/datetime';
import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CardReading} from '../CardReading';
import {Button} from '../ui/button';
import {Card, CardContent} from '../ui/card';

interface AdminCardItem {
    id: string;
    userId: string;
    user: {
        id: string;
        email: string | null;
        name: string | null;
        username: string | null;
    };
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

interface AdminCardsResponse {
    items: AdminCardItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    message?: string;
}

function userLabel (item: AdminCardItem): string {
    const parts = [
        item.user.name,
        item.user.email,
        item.user.username ? `@${item.user.username}` : ''
    ].filter((part): part is string => Boolean(part));
    return parts.join(' · ');
}

export const AdminCardsPage = () => {
    const [items, setItems] = useState<AdminCardItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const navigate = useNavigate();

    const fetchCards = useCallback(async (p: number) => {
        setLoading(true);
        setError('');
        setForbidden(false);
        try {
            const response = await fetch(`/api/admin/cards?page=${p}&pageSize=10`, {
                credentials: 'include'
            });
            const data = await response.json().catch(() => null) as AdminCardsResponse | null;
            if (response.status === 403) {
                setForbidden(true);
                setError(data?.message || '没有权限查看全部卡片。');
                setItems([]);
                return;
            }
            if (!response.ok || !data?.items || !data.pagination) {
                throw new Error(data?.message || '暂时无法读取全部卡片');
            }
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
        void fetchCards(1);
    }, [fetchCards]);

    return (
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto max-w-3xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold">全部卡片</h1>
                        <p className="mt-1 text-sm text-muted-foreground">系统里每一张卡片，不限用户。</p>
                    </div>
                    {total > 0 && <span className="text-sm text-muted-foreground">共 {total} 张</span>}
                </div>

                {loading && items.length === 0
                    ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )
                    : forbidden
                    ? (
                        <div className="py-10 text-center">
                            <p className="text-sm text-red-500">{error}</p>
                            <Button variant="outline" className="mt-4" onClick={() => navigate('/history')}>
                                返回历史
                            </Button>
                        </div>
                    )
                    : error
                    ? (
                        <div className="py-10 text-center">
                            <p className="text-sm text-red-500">加载失败：{error}</p>
                            <Button variant="outline" className="mt-4" onClick={() => fetchCards(page)}>
                                重试
                            </Button>
                        </div>
                    )
                    : items.length === 0
                    ? (
                        <div className="py-20 text-center">
                            <p className="text-muted-foreground">系统里还没有卡片</p>
                        </div>
                    )
                    : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <Card key={item.id} className="overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            {item.illustrationUrl
                                                ? (
                                                    <img
                                                        src={item.illustrationUrl}
                                                        alt=""
                                                        className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
                                                    />
                                                )
                                                : (
                                                    <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-muted text-center text-xs text-muted-foreground">
                                                        没有配图
                                                    </div>
                                                )}
                                            <div className="min-w-0 flex-1">
                                                <p className="break-all font-mono text-xs text-muted-foreground">
                                                    {item.id}
                                                </p>
                                                <p className="mt-1 text-sm">
                                                    {userLabel(item) || '没有用户资料'}
                                                </p>
                                                <p className="break-all font-mono text-xs text-muted-foreground">
                                                    用户 {item.user.id}
                                                </p>
                                                <div
                                                    className="mt-2 font-japanese text-base font-medium leading-relaxed [&_ruby]:font-normal"
                                                    dangerouslySetInnerHTML={{__html: item.sentenceHtml}}
                                                />
                                                <div className="mt-1">
                                                    <CardReading reading={item.reading} />
                                                </div>
                                                {item.gloss
                                                    ? <p className="mt-1 text-sm text-muted-foreground">{item.gloss}</p>
                                                    : <p className="mt-1 text-sm text-muted-foreground">没有释义</p>}
                                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{item.level}</span>
                                                    <span>
                                                        {item.createdAtText || formatShanghaiTimestamp(item.createdAt)}
                                                    </span>
                                                    <span className="font-mono">{item.createdAt}</span>
                                                </div>
                                                {item.illustrationUrl && (
                                                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                                                        {item.illustrationUrl}
                                                    </p>
                                                )}
                                                {item.audioUrl
                                                    ? (
                                                        <audio
                                                            controls
                                                            src={item.audioUrl}
                                                            className="mt-2 h-8 w-full max-w-sm"
                                                        >
                                                            您的浏览器不支持音频播放。
                                                        </audio>
                                                    )
                                                    : <p className="mt-2 text-xs text-muted-foreground">没有语音</p>}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 py-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1 || loading}
                                        onClick={() => fetchCards(page - 1)}
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
                                        onClick={() => fetchCards(page + 1)}
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
