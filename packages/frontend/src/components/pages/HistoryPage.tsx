import {type DaySignTile, DaySignTileButton} from '@/components/DaySignWall';
import {useAdminAccess} from '@/hooks/useAdminAccess';
import {parseShanghaiDayKey, wallDateFromStored} from '@/lib/datetime';
import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {FootprintHeat} from '../FootprintHeat';
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

interface DayGroup {
    key: string;
    breath: string;
    tiles: DaySignTile[];
}

function groupByShanghaiDay (items: CardHistoryItem[]): DayGroup[] {
    const groups: DayGroup[] = [];
    for (const item of items) {
        const date = wallDateFromStored(item.createdAt);
        const tile: DaySignTile = {
            id: item.id,
            sentence: item.sentence,
            thumbUrl: item.illustrationUrl,
            month: date.month,
            day: date.day,
            breath: date.breath
        };
        const last = groups[groups.length - 1];
        if (!last || last.key !== date.key) {
            groups.push({key: date.key, breath: date.breath, tiles: [tile]});
        } else {
            last.tiles.push(tile);
        }
    }
    return groups;
}

function dayBreath (dayKey: string): string {
    const parts = dayKey.split('-');
    return `${Number(parts[1])}月${Number(parts[2])}日`;
}

export const HistoryPage = () => {
    const [items, setItems] = useState<CardHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const admin = useAdminAccess();
    const dayKey = useMemo(() => parseShanghaiDayKey(searchParams.get('day') ?? '') ?? '', [searchParams]);

    const fetchHistory = useCallback(async (p: number, append: boolean) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                page: String(p),
                pageSize: dayKey ? '50' : '20'
            });
            if (dayKey) {
                params.set('day', dayKey);
            }
            const response = await fetch(`/api/history?${params.toString()}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('暂时无法读取学习历史');
            }
            const data = await response.json() as HistoryResponse;
            setItems((current) => append ? [...current, ...data.items] : data.items);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
            setPage(p);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            setError(/[\u4e00-\u9fff]/.test(message) ? message : '请稍后再试');
        } finally {
            setLoading(false);
        }
    }, [dayKey]);

    useEffect(() => {
        void fetchHistory(1, false);
    }, [fetchHistory]);

    const groups = groupByShanghaiDay(items);

    return (
        <div className="history-screen">
            <header className="history-header">
                <div className="flex items-end justify-between gap-3">
                    <h1>把喜欢的，留下。</h1>
                    <div className="flex gap-2">
                        {dayKey
                            ? (
                                <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
                                    整面墙
                                </Button>
                            )
                            : null}
                        {admin
                            ? (
                                <Button variant="outline" size="sm" onClick={() => navigate('/admin/cards')}>
                                    全部卡片
                                </Button>
                            )
                            : null}
                    </div>
                </div>
                <p className="sub">
                    {dayKey
                        ? (!loading && !error && items.length === 0
                            ? '这天还没抽'
                            : dayBreath(dayKey))
                        : (total > 0 ? `已轻记 ${total} 张` : '有些句子，值得再读一遍。')}
                </p>
            </header>

            <FootprintHeat selectedDay={dayKey || undefined} />

            {loading && items.length === 0
                ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
                    </div>
                )
                : error && items.length === 0
                ? (
                    <div className="py-10 text-center">
                        <p className="text-sm text-red-500">加载失败：{error}</p>
                        <Button variant="outline" className="mt-4" onClick={() => void fetchHistory(page, false)}>
                            重试
                        </Button>
                    </div>
                )
                : items.length === 0
                ? (
                    <div className="history-empty">
                        <span className="hiyori-empty-mark" aria-hidden="true">栞</span>
                        <p>{dayKey ? '这天还没抽' : '抽出的日签都会留在这里。'}</p>
                        <Button variant="outline" className="mt-5" onClick={() => navigate('/explore')}>
                            去抽一张 ↗
                        </Button>
                    </div>
                )
                : (
                    <div>
                        {groups.map((group) => (
                            <section key={group.key} aria-label={group.breath}>
                                <p className="wall-day-breath">{group.breath}</p>
                                <div className="wall-grid">
                                    {group.tiles.map((tile) => (
                                        <DaySignTileButton
                                            key={tile.id}
                                            tile={tile}
                                            onOpen={() => navigate(`/history/${tile.id}`)}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {error
                            ? <p className="py-4 text-center text-sm text-red-500">{error}</p>
                            : null}
                        {page < totalPages
                            ? (
                                <div className="flex justify-center py-6">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={loading}
                                        onClick={() => void fetchHistory(page + 1, true)}
                                    >
                                        {loading ? '翻看中…' : '更早的日签'}
                                    </Button>
                                </div>
                            )
                            : null}
                    </div>
                )}
        </div>
    );
};
