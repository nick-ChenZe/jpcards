import {useSession} from '@/lib/auth';
import {userFacingMedia, userFacingTextNotice} from '@/lib/userCopy';
import {useCallback, useEffect, useRef, useState} from 'react';
import {CardReading} from '../CardReading';
import {Nav} from '../Nav';
import {Button} from '../ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '../ui/card';

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
const QUOTA_EXHAUSTED_MESSAGE = '今日额度用完了';

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
                if (body?.error === 'QUOTA_EXCEEDED' || body?.message === QUOTA_EXHAUSTED_MESSAGE) {
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

    return (
        <div className="px-4 py-3 pb-20">
            <Nav session={data!.user} />
            <div className="mx-auto mt-4 max-w-3xl">
                <Card>
                    <CardHeader>
                        <CardTitle>日语卡片</CardTitle>
                        <CardDescription>
                            生成一句日语、读音、中文意思和配图。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Button
                                type="button"
                                size="lg"
                                className={exhausted ? 'card-generate card-generate-exhausted' : 'card-generate'}
                                onClick={generateCard}
                                disabled={loading || exhausted}
                            >
                                {loading ? '生成中...' : '生成一张卡片'}
                            </Button>
                            <p className="text-sm text-muted-foreground" aria-live="polite">
                                {exhausted
                                    ? QUOTA_EXHAUSTED_MESSAGE
                                    : (
                                        <>
                                            今日还可生成{' '}
                                            <span className="font-semibold text-foreground">
                                                {quota ? quota.remaining : '…'}/{limit}
                                            </span>{' '}
                                            张
                                        </>
                                    )}
                            </p>
                        </div>

                        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
                        {error ? <p className="text-sm text-red-500">生成失败：{error}</p> : null}

                        {card
                            ? (
                                <div className="space-y-4">
                                    <div
                                        className="font-japanese text-lg font-medium leading-relaxed [&_ruby]:font-normal"
                                        dangerouslySetInnerHTML={{__html: card.sentenceHtml}}
                                    />
                                    <CardReading reading={card.reading} />
                                    {card.gloss
                                        ? <p className="text-sm text-muted-foreground">{card.gloss}</p>
                                        : null}
                                    {userFacingTextNotice(card.text?.message)
                                        ? (
                                            <p className="text-sm text-muted-foreground">
                                                {userFacingTextNotice(card.text?.message)}
                                            </p>
                                        )
                                        : null}
                                    {card.imageDataUrl
                                        ? (
                                            <img
                                                src={card.imageDataUrl}
                                                alt="日语句子配图"
                                                className="w-full max-w-xl rounded-lg border"
                                            />
                                        )
                                        : (
                                            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                                {userFacingMedia('image', card.image?.message)}
                                            </p>
                                        )}
                                    {card.audioDataUrl
                                        ? (
                                            <audio controls src={card.audioDataUrl} className="w-full max-w-xl">
                                                您的浏览器不支持音频播放。
                                            </audio>
                                        )
                                        : (
                                            <p className="text-sm text-muted-foreground">
                                                {userFacingMedia('audio', card.audio?.message)}
                                            </p>
                                        )}
                                </div>
                            )
                            : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
