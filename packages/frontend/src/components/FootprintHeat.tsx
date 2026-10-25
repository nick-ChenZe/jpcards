import {buildFootprintMonth, type FootprintCell, footprintWindow, shiftFootprintMonth} from '@/lib/heatmapGrid';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function cellLabel (cell: FootprintCell, pending: boolean): string {
    const date = `${cell.month}月${cell.dayOfMonth}日`;
    return pending ? `${date}，日子还在展开` : `${date}，${cell.count > 0 ? `${cell.count}张日签` : '这天还没抽'}`;
}

export function FootprintHeat ({selectedDay}: {selectedDay?: string;}) {
    const navigate = useNavigate();
    const today = useMemo(() => footprintWindow().today, []);
    const thisMonth = today.slice(0, 7);
    const [month, setMonth] = useState(() => selectedDay?.slice(0, 7) || thisMonth);
    const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
    const [pending, setPending] = useState(true);
    const [failed, setFailed] = useState(false);
    const [note, setNote] = useState('');
    const [retry, setRetry] = useState(0);
    const range = useMemo(() => buildFootprintMonth(month, today, counts), [month, today, counts]);

    useEffect(() => {
        if (selectedDay) setMonth(selectedDay.slice(0, 7));
    }, [selectedDay]);

    useEffect(() => {
        let cancelled = false;
        setPending(true);
        setFailed(false);
        setNote('');
        const load = async () => {
            try {
                const response = await fetch(`/api/me/heatmap?from=${range.from}&to=${range.to}`, {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('heatmap');
                const body: unknown = await response.json();
                if (!Array.isArray(body)) throw new Error('Invalid heatmap');
                const next = new Map<string, number>();
                for (const row of body) {
                    if (
                        row && typeof row === 'object' && 'day' in row && typeof row.day === 'string'
                        && 'count' in row && typeof row.count === 'number' && Number.isFinite(row.count)
                        && row.count > 0
                    ) {
                        next.set(row.day, Math.floor(row.count));
                    }
                }
                if (!cancelled) setCounts(next);
            } catch {
                if (!cancelled) {
                    setCounts(new Map());
                    setFailed(true);
                }
            } finally {
                if (!cancelled) setPending(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [range.from, range.to, retry]);

    const days = range.cells.filter((cell): cell is FootprintCell => cell !== null);
    const drawn = days.reduce((sum, cell) => sum + cell.count, 0);
    const marked = days.filter((cell) => cell.count > 0).length;
    const showInvite = !pending && !failed && drawn === 0;
    const openCell = (cell: FootprintCell) => {
        if (pending || failed || cell.future) return;
        if (cell.count > 0) {
            navigate(`/history?day=${cell.day}`);
            return;
        }
        setNote(`${cell.month}月${cell.dayOfMonth}日，这天还没抽。`);
    };

    return (
        <section className="footprint footprint-monthly" aria-label="纸上的日子" aria-busy={pending}>
            <div className="footprint-heading">
                <h2>纸上的日子</h2>
                <span>日々の記録</span>
            </div>
            <div className="footprint-toolbar">
                <div className="footprint-month-label">
                    <strong>{range.month}月</strong>
                    <span>{range.year}</span>
                </div>
                <div className="footprint-month-nav">
                    {month !== thisMonth
                        ? (
                            <button type="button" className="footprint-reset" onClick={() => setMonth(thisMonth)}>
                                本月
                            </button>
                        )
                        : null}
                    <button
                        type="button"
                        aria-label="上个月"
                        onClick={() => setMonth((value) => shiftFootprintMonth(value, -1))}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label="下个月"
                        disabled={month >= thisMonth}
                        onClick={() => setMonth((value) => shiftFootprintMonth(value, 1))}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
            <p className="footprint-summary" aria-live="polite">
                {pending
                    ? '正在展开这一页…'
                    : failed
                    ? '足迹暂时没有展开。'
                    : `本月轻记 ${drawn} 张 · ${marked} 天留下墨迹`}
            </p>
            <div className="footprint-weekdays" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="footprint-calendar" role="group" aria-label={`${range.year}年${range.month}月的日签足迹`}>
                {range.cells.map((cell, index) =>
                    cell
                        ? (
                            <button
                                key={cell.day}
                                type="button"
                                className="footprint-day"
                                data-ink={pending || failed ? 0 : cell.level}
                                data-today={cell.today || undefined}
                                data-selected={selectedDay === cell.day || undefined}
                                data-future={cell.future || undefined}
                                aria-current={cell.today ? 'date' : undefined}
                                aria-label={cellLabel(cell, pending)}
                                disabled={pending || failed || cell.future}
                                onClick={() => openCell(cell)}
                            >
                                <span className="footprint-day-number">{cell.dayOfMonth}</span>
                                <span className="footprint-day-ink" aria-hidden="true" />
                            </button>
                        )
                        : <span key={`space-${index}`} className="footprint-calendar-space" aria-hidden="true" />
                )}
            </div>
            <div className="footprint-caption">
                <span className="footprint-today-key">今天</span>
                <div className="footprint-ink-key" aria-label="墨色越浓，日签越多">
                    <span>淡</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                        <i key={level} className="footprint-key-swatch" data-ink={level} aria-hidden="true" />
                    ))}
                    <span>浓</span>
                </div>
            </div>
            {failed
                ? (
                    <button type="button" className="footprint-retry" onClick={() => setRetry((value) => value + 1)}>
                        重新展开 ↻
                    </button>
                )
                : null}
            {showInvite ? <p className="footprint-invite">抽出今日的日签，就会落在这里。</p> : null}
            {note ? <p className="footprint-note" aria-live="polite">{note}</p> : null}
        </section>
    );
}
