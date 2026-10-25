import {useSession} from '@/lib/auth';
import {userFacingMedia, userFacingTextNotice} from '@/lib/userCopy';
import {useCallback, useState} from 'react';
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

export const ExplorePage = () => {
    const [card, setCard] = useState<CardDemoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const {data} = useSession();

    const generateCard = useCallback(async () => {
        setLoading(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/card', {credentials: 'include'});
            const body = await response.json().catch(() => null) as (CardDemoResponse & ErrorBody) | null;
            if (!response.ok) {
                setCard(null);
                setNotice(body?.message || '暂时不能生成卡片。');
                return;
            }
            setCard(body);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : '';
            setError(/[\u4e00-\u9fff]/.test(message) ? message : '请稍后再试');
        } finally {
            setLoading(false);
        }
    }, []);

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
                        <Button
                            type="button"
                            size="lg"
                            className="card-generate"
                            onClick={generateCard}
                            disabled={loading}
                        >
                            {loading ? '生成中...' : '生成一张卡片'}
                        </Button>

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
