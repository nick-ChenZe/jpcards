import {useSession} from '@/lib/auth';
import {Nav} from '../Nav';
import {Button} from '../ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '../ui/card';
import {useCallback, useState} from 'react';

interface CardDemoResponse {
    id?: string;
    sentence: string;
    sentenceHtml: string;
    imageDataUrl: string;
    audioDataUrl: string;
}

export const ExplorePage = () => {
    const [card, setCard] = useState<CardDemoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const {data} = useSession();

    const generateCard = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/card', {credentials: 'include'});
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const data = await response.json() as CardDemoResponse;
            setCard(data);
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
                            点击按钮生成一句日语、配图和语音
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={generateCard} disabled={loading}>
                            {loading ? '生成中...' : '生成一张卡片'}
                        </Button>

                        {error ? (
                            <p className="text-sm text-red-500">生成失败：{error}</p>
                        ) : null}

                        {card ? (
                            <div className="space-y-4">
                                <div
                                    className="font-japanese text-lg font-medium leading-relaxed [&_ruby]:font-normal"
                                    dangerouslySetInnerHTML={{__html: card.sentenceHtml}}
                                />
                                <img
                                    src={card.imageDataUrl}
                                    alt="日语句子配图"
                                    className="w-full max-w-xl rounded-lg border"
                                />
                                <audio controls src={card.audioDataUrl} className="w-full max-w-xl">
                                    您的浏览器不支持音频播放。
                                </audio>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
