import {type CardStage, readCardResponse} from '@/lib/cardProgress';
import {shanghaiRitualDate} from '@/lib/datetime';
import {generateCardInit} from '@/lib/generateCard';
import {gateDrawAttempt, isQuotaExceededDenial, isQuotaSnapshot, type QuotaSnapshot} from '@/lib/quotaGate';
import {streakChipText} from '@/lib/streakNote';
import {userFacingMedia, userFacingTextNotice} from '@/lib/userCopy';
import {cn} from '@/lib/utils';
import {useCallback, useEffect, useRef, useState} from 'react';
import {GenerateBar} from '../GenerateBar';
import {GenerationProgress} from '../GenerationProgress';
import {PaperMotif} from '../PaperMotif';
import {QuotaSeal} from '../QuotaSeal';
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

type ExploreState = 'empty' | 'drawing' | 'hero';

const DAILY_CARD_LIMIT = 20;

function StreakChip ({days, pending}: {days: number | null; pending: boolean;}) {
    const text = streakChipText(days, pending);
    const waiting = text === null;
    return (
        <p
            className={cn('streak-chip', waiting ? 'is-pending' : 'is-settled')}
            data-streak={waiting ? 'pending' : days !== null && days > 0 ? 'count' : 'empty'}
            aria-busy={waiting}
            aria-live="polite"
        >
            {waiting ? <span className="streak-hold" /> : text}
        </p>
    );
}

function EmptyRitual ({drawing = false}: {drawing?: boolean;}) {
    return (
        <div
            className={cn('hiyori-empty-card', drawing && 'is-drawing')}
            role={drawing ? 'status' : undefined}
            aria-busy={drawing}
        >
            <div className="hiyori-ticket-top">
                <span>一期一会</span>
                <span>DAILY FORTUNE</span>
            </div>
            <PaperMotif />
            <h2>{drawing ? '正为你寻一句好日语。' : '今天，会遇见哪句话？'}</h2>
            <p>
                {drawing ? '纸签轻摇，等一句与你相遇的话。' : '把一点期待，留给未知。'}
                <br />
                {drawing ? '生成完成后，日签会在这里展开。' : '抽一张日签，开启今天的日语时光。'}
            </p>
        </div>
    );
}

export const ExplorePage = () => {
    const [card, setCard] = useState<CardDemoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState<CardStage>('sentence');
    const [startedAt, setStartedAt] = useState(0);
    const [expected] = useState(() => {
        try {
            const previous = Number(localStorage.getItem('rizha-generation-seconds'));
            return previous >= 15 && previous <= 180 ? previous : 50;
        } catch {
            return 50;
        }
    });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
    const [streakDays, setStreakDays] = useState<number | null>(null);
    const [streakPending, setStreakPending] = useState(true);
    const [stampKey, setStampKey] = useState(0);
    const [arming, setArming] = useState(false);
    const quotaEpoch = useRef(0);
    const streakEpoch = useRef(0);
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
        const epoch = ++streakEpoch.current;
        try {
            const response = await fetch('/api/me', {credentials: 'include'});
            if (epoch !== streakEpoch.current || !response.ok) {
                return;
            }
            const body = await response.json() as {streakDays?: unknown;};
            if (epoch !== streakEpoch.current) {
                return;
            }
            if (typeof body.streakDays === 'number' && Number.isFinite(body.streakDays)) {
                setStreakDays(Math.max(0, Math.floor(body.streakDays)));
            }
        } catch {
            // 连签只是轻记，读失败不挡抽签。
        } finally {
            if (epoch === streakEpoch.current) {
                setStreakPending(false);
            }
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
        if (gateDrawAttempt({inFlight: generating.current, remaining: quota ? quota.remaining : null}) === 'stop') {
            return;
        }
        generating.current = true;
        const started = Date.now();
        setError('');
        setNotice('');
        setArming(true);
        let drawing = false;
        const enterDrawing = (stage: CardStage) => {
            if (!drawing) {
                drawing = true;
                setStartedAt(started);
                setLoading(true);
            }
            setStage(stage);
        };
        try {
            const init = generateCardInit();
            const headers = new Headers(init.headers);
            headers.set('Accept', 'application/x-ndjson');
            const response = await fetch('/api/card', {...init, headers});
            const {status, body} = await readCardResponse<CardDemoResponse & ErrorBody & {quota?: unknown;}>(
                response,
                enterDrawing
            );
            // 额度 429 发生在进度之前。不进入抽签中，眼前的日签留在原处。
            if (isQuotaExceededDenial(status, body)) {
                noteExhausted();
                setNotice('');
                return;
            }
            if (status === 429) {
                setNotice(body?.message || '生成太频繁，请稍后再试。');
                return;
            }
            if (status < 200 || status >= 300 || !body) {
                if (!heldCard.current) {
                    setCard(null);
                }
                setNotice(body?.message || '暂时不能生成卡片。');
                return;
            }
            const {quota: responseQuota, ...cardBody} = body;
            try {
                localStorage.setItem('rizha-generation-seconds', String(Math.round((Date.now() - started) / 1000)));
            } catch { /* Optional estimate. */ }
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
            setArming(false);
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

    const [year, month, day] = ritual.dayKey.split('-');
    return (
        <div className="explore-screen hiyori-explore" data-state={exploreState}>
            <header className="hiyori-date-row">
                <div className="hiyori-date-block">
                    <span className="hiyori-day">{Number(day)}</span>
                    <div className="hiyori-date-meta">
                        <span>{year} / {month}</span>
                        <span>{ritual.weekday} · {ritual.fullDate}</span>
                    </div>
                </div>
                <div className="hiyori-date-aside">
                    <StreakChip days={streakDays} pending={streakPending} />
                    <QuotaSeal remaining={quota ? quota.remaining : null} limit={limit} />
                </div>
            </header>
            <div className="hiyori-section-title">
                <h1>今日日签</h1>
                <span>A LITTLE EVERY DAY</span>
            </div>
            <div className="hiyori-ticket-stage" key={`card-${stampKey}`}>
                {card && !loading
                    ? (
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
                    )
                    : loading
                    ? <GenerationProgress stage={stage} startedAt={startedAt} expected={expected} />
                    : <EmptyRitual />}
            </div>
            <div className="hiyori-notices" aria-live="polite">{notices}</div>
            <GenerateBar
                compact={Boolean(card)}
                loading={loading || arming}
                exhausted={exhausted}
                onGenerate={generateCard}
            />
            <p className="hiyori-endnote">每天一点点，日语慢慢来。</p>
        </div>
    );
};
