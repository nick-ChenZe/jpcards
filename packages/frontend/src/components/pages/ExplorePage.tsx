import {useSession} from '@/lib/auth';
import {QUOTA_EXCEEDED_MESSAGE, userFacingMedia, userFacingTextNotice} from '@/lib/userCopy';
import {useCallback, useEffect, useRef, useState} from 'react';
import {GenerateBar} from '../GenerateBar';
import {Nav} from '../Nav';
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

export const ExplorePage = () => {
    const [card, setCard] = useState<CardDemoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
    const quotaEpoch = useRef(0);
    const generating = useRef(false);

    const {data} = useSession();
    const exhausted = quota !== null && quota.remaining <= 0;
    const limit = quota?.limit ?? DAILY_CARD_LIMIT;

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

    useEffect(() => {
        void refreshQuota();
    }, [refreshQuota]);

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
            const response = await fetch('/api/card', {credentials: 'include'});
            const body = await response.json().catch(() => null) as (CardDemoResponse & ErrorBody) | null;
            if (response.status === 429) {
                if (body?.error === 'QUOTA_EXCEEDED' || body?.message === QUOTA_EXCEEDED_MESSAGE) {
                    noteExhausted();
                    setNotice('');
                } else {
                    setNotice(body?.message || '生成太频繁，请稍后再试。');
                }
                return;
            }
            if (!response.ok) {
                setCard(null);
                setNotice(body?.message || '暂时不能生成卡片。');
                return;
            }
            setCard(body);
            noteSuccessfulUse();
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : '';
            setError(/[\u4e00-\u9fff]/.test(message) ? message : '请稍后再试');
        } finally {
            generating.current = false;
            setLoading(false);
            void refreshQuota();
        }
    }, [quota, refreshQuota]);

    const textNote = userFacingTextNotice(card?.text?.message);

    return (
        <div className="px-4 py-3 pb-20">
            <div className="mx-auto flex max-w-lg flex-col gap-4">
                <Nav session={data!.user} />
                <GenerateBar
                    remaining={quota ? quota.remaining : null}
                    limit={limit}
                    loading={loading}
                    exhausted={exhausted}
                    onGenerate={generateCard}
                />

                {notice ? <p className="text-sm text-ink-muted">{notice}</p> : null}
                {error ? <p className="text-sm text-red-500">生成失败：{error}</p> : null}

                {loading
                    ? <TodayCard loading />
                    : card
                    ? (
                        <TodayCard
                            sentenceHtml={card.sentenceHtml}
                            reading={card.reading}
                            readingTokens={card.readingTokens}
                            gloss={card.gloss}
                            imageUrl={card.imageDataUrl}
                            imageMessage={userFacingMedia('image', card.image?.message)}
                            audioUrl={card.audioDataUrl}
                            note={textNote}
                        />
                    )
                    : null}
            </div>
        </div>
    );
};
