import {shanghaiRitualDate} from '@/lib/datetime';
import {generateCardInit} from '@/lib/generateCard';
import {QUOTA_EXCEEDED_MESSAGE, userFacingMedia, userFacingTextNotice} from '@/lib/userCopy';
import {cn} from '@/lib/utils';
import {useCallback, useEffect, useRef, useState} from 'react';
import {GenerateBar} from '../GenerateBar';
import {TodayCard} from '../TodayCard';

interface MediaNotice {
    ok: boolean;
    message?: string;
}

interface TextNotice {
    configured: boolean;
    source: 'model' | 'local';
    message: string;
}

interface CardDemoResponse {
    id?: string;
    sentence: string;
    sentenceHtml: string;
    reading?: string;
    readingTokens?: unknown;
    gloss?: string;
    imageDataUrl: string;
    audioDataUrl: string;
    text?: TextNotice;
    image?: MediaNotice;
    audio?: MediaNotice;
}

interface ErrorBody {
    error?: string;
    message?: string;
}

interface QuotaSnapshot {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
}

type ExploreState = 'empty' | 'drawing' | 'hero';

const DAILY_CARD_LIMIT = 20;

function isQuotaSnapshot (value: unknown): value is QuotaSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const quota = value as Partial<QuotaSnapshot>;
    return typeof quota.limit === 'number'
        && typeof quota.used === 'number'
        && typeof quota.remaining === 'number'
        && typeof quota.resetsAt === 'string';
}

function StreakChip ({days}: {days: number | null;}) {
    const text = days !== null && days > 0
        ? `已连签 ${days} 天 · 轻记一下就好`
        : '轻记一下就好';
    return (
        <p className="streak-chip" aria-label="连签">
            <span className="dot" />
            {text}
        </p>
    );
}

function EmptyRitual () {
    return (
        <div className="empty-ritual">
            <svg className="empty-icon" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                <rect x="16" y="12" width="40" height="48" rx="4" stroke="#8A857C" strokeWidth="1.5" />
                <path d="M24 26h24M24 34h18M24 42h12" stroke="#8A857C" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="48" cy="52" r="12" fill="#F7F3EB" stroke="#C45C4A" strokeWidth="1.5" />
                <text x="48" y="56" textAnchor="middle" fill="#C45C4A" fontSize="11" fontFamily="serif">签</text>
            </svg>
            <p>今日还没有日签</p>
            <p className="hint">轻按上方，抽出一张</p>
        </div>
    );
}

export const ExplorePage = () => {
    const [card, setCard] = useState<CardDemoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
    const [streakDays, setStreakDays] = useState<number | null>(null);
    const [stampKey, setStampKey] = useState(0);
    const quotaEpoch = useRef(0);
    const generating = useRef(false);
    const heldCard = useRef<CardDemoResponse | null>(null);

    const exhausted = quota !== null && quota.remaining <= 0;
    const limit = quota?.limit ?? DAILY_CARD_LIMIT;
    const ritual = shanghaiRitualDate();
    const exploreState: ExploreState = loading ? 'drawing' : card ? 'hero' : 'empty';

    const refreshQuota = useCallback(async () => {
        const epoch = ++quotaEpoch.current;
        try {
            const response = await fetch('/api/me/quota', {credentials: 'include'});
            if (!response.ok) {
                return;
            }
            const body: unknown = await response.json();
            if (epoch !== quotaEpoch.current || !isQuotaSnapshot(body)) {
                return;
            }
            setQuota(body);
        } catch {
            // 额度读失败时仍可点生成，服务端会拦截超额请求。
        }
    }, []);

    const refreshStreak = useCallback(async () => {
        try {
            const response = await fetch('/api/me', {credentials: 'include'});
            if (!response.ok) {
                return;
            }
            const body = await response.json() as {streakDays?: unknown;};
            if (typeof body.streakDays === 'number' && Number.isFinite(body.streakDays)) {
                setStreakDays(Math.max(0, Math.floor(body.streakDays)));
            }
        } catch {
            // 连签只是轻记，读失败不挡抽签。
        }
    }, []);

    useEffect(() => {
        void refreshQuota();
        void refreshStreak();
    }, [refreshQuota, refreshStreak]);

    const noteSuccessfulUse = () => {
        quotaEpoch.current += 1;
        setQuota((current) => {
            if (!current) {
                return current;
            }
            const used = Math.min(current.limit, current.used + 1);
            return {...current, used, remaining: Math.max(0, current.limit - used)};
        });
    };

    const noteExhausted = () => {
        quotaEpoch.current += 1;
        setQuota((current) => ({
            limit: current?.limit ?? DAILY_CARD_LIMIT,
            used: current?.limit ?? DAILY_CARD_LIMIT,
            remaining: 0,
            resetsAt: current?.resetsAt ?? ''
        }));
    };

    const generateCard = useCallback(async () => {
        if (generating.current || (quota && quota.remaining <= 0)) {
            return;
        }
        generating.current = true;
        setLoading(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/card', generateCardInit());
            const body = await response.json().catch(() => null) as
                | (CardDemoResponse & ErrorBody & {quota?: unknown;})
                | null;
            if (response.status === 429) {
                if (body?.error === 'QUOTA_EXCEEDED' || body?.message === QUOTA_EXCEEDED_MESSAGE) {
                    noteExhausted();
                    setNotice('');
                } else {
                    setNotice(body?.message || '生成太频繁，请稍后再试。');
                }
                return;
            }
            if (!response.ok || !body) {
                if (!heldCard.current) {
                    setCard(null);
                }
                setNotice(body?.message || '暂时不能生成卡片。');
                return;
            }
            const {quota: responseQuota, ...cardBody} = body;
            heldCard.current = cardBody;
            setCard(cardBody);
            setStampKey((value) => value + 1);
            if (isQuotaSnapshot(responseQuota)) {
                quotaEpoch.current += 1;
                setQuota(responseQuota);
            } else {
                noteSuccessfulUse();
            }
            void refreshStreak();
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : '';
            setError(/[\u4e00-\u9fff]/.test(message) ? message : '请稍后再试');
        } finally {
            generating.current = false;
            setLoading(false);
            void refreshQuota();
        }
    }, [quota, refreshQuota, refreshStreak]);

    const textNote = userFacingTextNotice(card?.text?.message);
    const notices = (
        <>
            {notice ? <p className="mb-3 text-sm text-ink-muted">{notice}</p> : null}
            {error ? <p className="mb-3 text-sm text-red-500">生成失败：{error}</p> : null}
        </>
    );

    return (
        <div className="explore-screen" data-state={exploreState}>
            <header className="ritual-header">
                <div className="ritual-date">
                    <span className="weekday">{ritual.weekday}</span>
                    <span className="fulldate">{ritual.fullDate}</span>
                </div>
                <div
                    key={stampKey}
                    className={cn('stamp', exploreState === 'hero' && stampKey > 0 && 'settle')}
                    aria-hidden="true"
                >
                    <span>日签</span>
                </div>
            </header>

            {exploreState === 'hero' && card
                ? (
                    <>
                        <div className="hero-chrome">
                            <StreakChip days={streakDays} />
                            <GenerateBar
                                compact
                                remaining={quota ? quota.remaining : null}
                                limit={limit}
                                loading={loading}
                                exhausted={exhausted}
                                onGenerate={generateCard}
                            />
                        </div>
                        <div className="px-4">{notices}</div>
                        <div className="hero-stage" key={card.id ?? card.sentence}>
                            <TodayCard
                                variant="hero"
                                sentenceHtml={card.sentenceHtml}
                                reading={card.reading}
                                readingTokens={card.readingTokens}
                                gloss={card.gloss}
                                imageUrl={card.imageDataUrl}
                                imageMessage={userFacingMedia('image', card.image?.message)}
                                audioUrl={card.audioDataUrl || null}
                                note={textNote}
                                meta="今天"
                            />
                        </div>
                    </>
                )
                : (
                    <div className="screen-scroll">
                        <p className="section-label">今日日签</p>
                        <StreakChip days={streakDays} />
                        <GenerateBar
                            remaining={quota ? quota.remaining : null}
                            limit={limit}
                            loading={loading}
                            exhausted={exhausted}
                            onGenerate={generateCard}
                        />
                        {notices}
                        {exploreState === 'drawing'
                            ? <TodayCard loading loadingLabel="抽签中…" />
                            : <EmptyRitual />}
                    </div>
                )}
        </div>
    );
};
