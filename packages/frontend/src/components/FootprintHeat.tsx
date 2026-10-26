import {buildFootprintMonth, type FootprintCell, footprintWindow, shiftFootprintMonth} from '@/lib/heatmapGrid';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {SealFoxEmpty} from './SealFox';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function cellLabel (cell: FootprintCell, pending: boolean): string {
    const date = `${cell.month}月${cell.dayOfMonth}日`;
    return pending ? `${date}，日子还在展开` : `${date}，${cell.count > 0 ? `${cell.count}张日签` : '这天还没抽'}`;
}

export function FootprintHeat ({selectedDay}: {selectedDay?: string;}) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const today = useMemo(() => footprintWindow().today, []);
    const thisMonth = today.slice(0, 7);
    const [month, setMonth] = useState(() => {
        const saved = params.get('month') ?? '';
        return selectedDay?.slice(0, 7)
            || (/^\d{4}-(0[1-9]|1[0-2])$/.test(saved) && saved <= thisMonth ? saved : thisMonth);
    });
    const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
    const [pending, setPending] = useState(true);
    const [failed, setFailed] = useState(false);
    const [settledRange, setSettledRange] = useState('');
    const [retry, setRetry] = useState(0);
    const range = useMemo(() => buildFootprintMonth(month, today, counts), [month, today, counts]);

    useEffect(() => {
        if (selectedDay) setMonth(selectedDay.slice(0, 7));
    }, [selectedDay]);

    useEffect(() => {
        let cancelled = false;
        setPending(true);
        setFailed(false);
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
                if (!cancelled) {
                    setPending(false);
                    setSettledRange(`${range.from}:${range.to}`);
                }
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
    const monthEmpty = settledRange === `${range.from}:${range.to}` && !pending && !failed && marked === 0;
    const openCell = (cell: FootprintCell) => {
        if (pending || failed || cell.future) return;
        navigate(`/history?day=${cell.day}`);
    };

    return (
        <section className="footprint footprint-monthly" aria-label="纸上的日子" aria-busy={pending}>
            <div className="footprint-toolbar">
                <div className="footprint-month-label">
                    <strong>
                        {String(range.month).padStart(2, '0')}
                        <small>月</small>
                    </strong>
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
            <div className="footprint-weekdays" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div
                className="footprint-calendar"
                style={{gridTemplateRows: `repeat(${range.cells.length / 7}, minmax(0, 1fr))`}}
                role="group"
                aria-label={`${range.year}年${range.month}月的日签足迹`}
            >
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
            {monthEmpty
                ? (
                    <div className="footprint-empty">
                        <SealFoxEmpty />
                        <p>还没有足迹</p>
                    </div>
                )
                : null}
            <div className="footprint-caption">
                <span aria-live="polite">
                    {pending ? '正在翻开…' : failed ? '暂时未能读取' : `${marked} 天 · ${drawn} 枚日签`}
                </span>
                <span>点一日，重读那天</span>
            </div>
            {failed
                ? (
                    <button type="button" className="footprint-retry" onClick={() => setRetry((value) => value + 1)}>
                        重新展开 ↻
                    </button>
                )
                : null}
        </section>
    );
}
