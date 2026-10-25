export type CardStage = 'sentence' | 'illustration' | 'finishing';
export type ReportCardStage = (stage: CardStage) => void;

/** Optional streaming transport; JSON callers retain their original HTTP status codes. */
export function cardProgressStream (
    run: (report: ReportCardStage) => Promise<{status: number; body: Record<string, unknown>;}>
): Response {
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (value: unknown) => {
                if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
            };
            try {
                const result = await run((stage) => send({type: 'progress', stage}));
                send({type: 'result', ...result});
            } catch {
                send({type: 'result', status: 500, body: {message: '生成失败，请稍后再试。'}});
            } finally {
                if (!closed) controller.close();
                closed = true;
            }
        },
        cancel() {
            closed = true;
        }
    });
    return new Response(stream, {
        headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform'}
    });
}
