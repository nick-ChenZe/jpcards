import {buildFootprintWeeks, type FootprintCell, footprintWindow} from '@/lib/heatmapGrid';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function cellLabel (cell: FootprintCell, pending: boolean): string {
    if (pending) {
        return '日子还在展开';
    }
    if (cell.count > 0) {
        return `${cell.month}月${cell.dayOfMonth}日，${cell.count}张`;
    }
    return '这天还没抽';
}

export function FootprintHeat ({selectedDay}: {selectedDay?: string;}) {
    const navigate = useNavigate();
    const range = useMemo(() => footprintWindow(), []);
    const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
    const [pending, setPending] = useState(true);
    const [failed, setFailed] = useState(false);
    const [note, setNote] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(
                    `/api/me/heatmap?from=${range.from}&to=${range.to}`,
                    {credentials: 'include'}
                );
                if (!response.ok) {
                    throw new Error('heatmap');
                }
                const body: unknown = await response.json();
                if (cancelled) {
                    return;
                }
                const next = new Map<string, number>();
                if (Array.isArray(body)) {
                    for (const row of body) {
                        if (!row || typeof row !== 'object') {
                            continue;
                        }
                        const day = 'day' in row && typeof row.day === 'string' ? row.day : '';
                        const count = 'count' in row && typeof row.count === 'number' ? row.count : 0;
                        if (day && count > 0) {
                            next.set(day, Math.floor(count));
                        }
                    }
                }
                setCounts(next);
                setFailed(false);
            } catch {
                if (!cancelled) {
                    setFailed(true);
                }
            } finally {
                if (!cancelled) {
                    setPending(false);
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [range.from, range.to]);

    const weeks = useMemo(
        () => buildFootprintWeeks(range.from, range.to, range.today, counts),
        [counts, range.from, range.to, range.today]
    );
    const drawn = useMemo(() => {
        let total = 0;
        for (const count of counts.values()) {
            total += count;
        }
        return total;
    }, [counts]);
    const showInvite = !pending && !failed && drawn === 0;

    const openCell = (cell: FootprintCell) => {
        if (pending || cell.future) {
            return;
        }
        if (cell.count > 0) {
            navigate(`/history?day=${cell.day}`);
            return;
        }
        setNote('这天还没抽');
    };

    return (
        <section
            className="footprint"
            aria-label="纸上的日子"
            aria-busy={pending}
        >
            <p className="section-label">纸上的日子</p>
            {showInvite ? <p className="footprint-invite">抽出今日的日签，就会落在这里。</p> : null}
            <div className="footprint-board">
                <div className="heat-dows" aria-hidden="true">
                    <span className="heat-month" />
                    {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
                </div>
                <div className="heat-weeks">
                    {weeks.map((week) => (
                        <div className="heat-week" key={week.id}>
                            <span className="heat-month">{week.monthLabel}</span>
                            {week.cells.map((cell) =>
                                cell.future
                                    ? (
                                        <span
                                            key={cell.day}
                                            className="heat-cell"
                                            data-ink="0"
                                            data-future="true"
                                        />
                                    )
                                    : (
                                        <button
                                            key={cell.day}
                                            type="button"
                                            className="heat-cell"
                                            data-ink={cell.level}
                                            data-today={cell.today ? 'true' : undefined}
                                            data-open={selectedDay === cell.day ? 'true' : undefined}
                                            aria-current={cell.today ? 'date' : undefined}
                                            aria-label={cellLabel(cell, pending)}
                                            disabled={pending}
                                            onClick={() => openCell(cell)}
                                        />
                                    )
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <p className="heat-legend">
                <span>无</span>
                <i className="heat-cell" data-ink="0" aria-hidden="true" />
                <span className="heat-legend-arrow" aria-hidden="true">→</span>
                <span>淡</span>
                <i className="heat-cell" data-ink="1" aria-hidden="true" />
                <span className="heat-legend-arrow" aria-hidden="true">→</span>
                <span>浓</span>
                <i className="heat-cell" data-ink="4" aria-hidden="true" />
            </p>
            <p className="footprint-note" aria-live="polite">
                {failed ? '足迹暂时没有展开。' : note}
            </p>
        </section>
    );
}
