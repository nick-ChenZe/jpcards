import {useSession} from '@/lib/auth';
import {useCallback, useState} from 'react';
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
            const message = requestError instanceof Error ? requestError.message : 'Unknown error';
            setError(message);
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
                            生成一句日语和中文释义。没有文本模型密钥时使用本地练习句。配图和语音未配置时不会请求外部服务。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={generateCard} disabled={loading}>
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
                                    {card.gloss
                                        ? <p className="text-sm text-muted-foreground">{card.gloss}</p>
                                        : null}
                                    {card.text?.message
                                        ? <p className="text-sm text-muted-foreground">{card.text.message}</p>
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
                                                {card.image?.message || '配图未配置'}
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
                                                {card.audio?.message || '语音未配置'}
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
