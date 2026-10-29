import {DaySignTileButton} from '@/components/DaySignWall';
import {parseShanghaiDayKey, wallDateFromStored} from '@/lib/datetime';
import {historyRequestState} from '@/lib/historyRequestState';
import {ArrowLeft, ChevronLeft, ChevronRight} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {FootprintHeat} from '../FootprintHeat';

interface HistoryItem {
    id: string;
    sentence: string;
    illustrationUrl: string | null;
    createdAt: string;
}

export const HistoryPage = () => {
    const [params, setParams] = useSearchParams();
    const day = parseShanghaiDayKey(params.get('day') ?? '') ?? '';
    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const [data, setData] = useState<
        {day: string; page: number; items: HistoryItem[]; total: number; totalPages: number;} | null
    >(
        null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{key: string; message: string;} | null>(null);
    const [retry, setRetry] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!day) return;
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        void (async () => {
            try {
                const response = await fetch(`/api/history?day=${day}&page=${page}&pageSize=3`, {
                    credentials: 'include',
                    signal: controller.signal
                });
                if (!response.ok) throw new Error('暂时无法读取日签');
                const body = await response.json();
                if (!controller.signal.aborted) {
                    setData({
                        day,
                        page,
                        items: body.items,
                        total: body.pagination.total,
                        totalPages: body.pagination.totalPages
                    });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError({key: `${day}:${page}`, message: '这一页暂时没有展开，请再试一次。'});
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [day, page, retry]);

    if (!day) {
        return (
            <div className="history-screen calendar-screen">
                <header className="calendar-page-heading">
                    <h1>日签墙</h1>
                    <span>日々の記録</span>
                </header>
                <FootprintHeat />
            </div>
        );
    }

    const {data: currentData, error: currentError, loading: isLoading} = historyRequestState(
        day,
        page,
        data,
        error,
        loading
    );
    const items = currentData?.items || [];
    const total = currentData?.total || 0;
    return (
        <div className="history-screen day-screen">
            <header className="day-page-heading">
                <button
                    className="paper-back"
                    type="button"
                    onClick={() => navigate(`/history?month=${day.slice(0, 7)}`)}
                    aria-label="返回月历"
                >
                    <ArrowLeft size={20} strokeWidth={1.3} />
                </button>
                <span>{Number(day.slice(5, 7))}月{Number(day.slice(8))}日</span>
                <small>{!isLoading && !currentError ? `${total} 枚` : '日签'}</small>
            </header>
            <div className="day-card-list" aria-busy={isLoading}>
                {isLoading
                    ? <p className="day-empty" role="status">正在翻开这一天…</p>
                    : currentError
                    ? (
                        <div className="day-empty">
                            <p>{currentError}</p>
                            <button onClick={() => setRetry(r => r + 1)}>重新翻开</button>
                        </div>
                    )
                    : items.length
                    ? items.map(item => {
                        const date = wallDateFromStored(item.createdAt);
                        return (
                            <DaySignTileButton
                                key={item.id}
                                tile={{
                                    id: item.id,
                                    sentence: item.sentence,
                                    thumbUrl: item.illustrationUrl,
                                    month: date.month,
                                    day: date.day,
                                    breath: '轻触重读'
                                }}
                                onOpen={() => navigate(`/history/${item.id}?day=${day}&page=${page}`)}
                            />
                        );
                    })
                    : (
                        <div className="day-empty">
                            <span className="day-empty-mark" aria-hidden="true">日</span>
                            <p>这一天还空着，也没关系。</p>
                            <p className="day-empty-note">今天也可以留下一句。</p>
                            <button type="button" onClick={() => navigate('/explore')}>抽今日签</button>
                        </div>
                    )}
            </div>
            <footer className="day-pagination">
                <button
                    aria-label="上一页日签"
                    disabled={isLoading || !currentData || page <= 1}
                    onClick={() => setParams({day, page: String(page - 1)})}
                >
                    <ChevronLeft size={19} />
                </button>
                <span>
                    {isLoading
                        ? '正在翻阅…'
                        : items.length
                        ? `${page} / ${currentData?.totalPages || 1}`
                        : '把一日，收在纸上。'}
                </span>
                <button
                    aria-label="下一页日签"
                    disabled={isLoading || !currentData || page >= (currentData?.totalPages || 1)}
                    onClick={() => setParams({day, page: String(page + 1)})}
                >
                    <ChevronRight size={19} />
                </button>
            </footer>
        </div>
    );
};
