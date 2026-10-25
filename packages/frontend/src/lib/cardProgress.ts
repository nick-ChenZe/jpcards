export type CardStage = 'sentence' | 'illustration' | 'finishing';

export const CARD_STAGES: CardStage[] = ['sentence', 'illustration', 'finishing'];

/** Read arbitrarily split UTF-8 chunks. A closed stream without a result is a failure. */
export async function readCardResponse<T> (response: Response, onStage: (stage: CardStage) => void): Promise<{
    status: number;
    body: T | null;
}> {
    if (!response.headers.get('Content-Type')?.includes('application/x-ndjson') || !response.body) {
        return {status: response.status, body: await response.json().catch(() => null) as T | null};
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let result: {status: number; body: T;} | null = null;
    const line = (value: string) => {
        if (!value.trim()) return;
        const event = JSON.parse(value);
        if (event.type === 'progress' && CARD_STAGES.includes(event.stage)) onStage(event.stage);
        if (event.type === 'result' && typeof event.status === 'number') {
            result = {status: event.status, body: event.body};
        }
    };
    try {
        for (;;) {
            const {done, value} = await reader.read();
            pending += decoder.decode(value, {stream: !done});
            const lines = pending.split('\n');
            pending = lines.pop() ?? '';
            for (const value of lines) line(value);
            if (done) break;
        }
        line(pending);
    } finally {
        reader.releaseLock();
    }
    if (!result) throw new Error('连接中断了，请稍后到日签墙查看。');
    return result;
}

/** Estimates are explicitly labelled; an overrun must never count down to a false zero. */
export function generationEstimate (elapsed: number, expected: number, stage: CardStage): string {
    if (stage === 'finishing') return '最后收好日签，预计还需几秒';
    if (elapsed > expected * 1.5) return '比平时稍久，仍在绘制中';
    const left = Math.max(5, Math.ceil((expected - elapsed) / 5) * 5);
    return `预计还需 ${Math.max(5, left - 5)}–${left + 15} 秒`;
}
