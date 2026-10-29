import {type Context, Hono} from 'hono';
import type {Env} from '../types.js';
import {positiveInteger, SocialError, SocialService} from './service.js';

type SocialVariables = {session: {user: {id: string;};} | null;};
type SocialEnv = {Bindings: Env; Variables: SocialVariables;};
export const socialRoutes = new Hono<SocialEnv>();

socialRoutes.onError((error, c) => {
    if (error instanceof SocialError) {
        if (error.status === 429) c.header('Retry-After', '60');
        return c.json({error: error.code, message: error.message}, error.status as 400);
    }
    console.error('Social request failed', error.name);
    return c.json({error: 'SOCIAL_UNAVAILABLE', message: '这页手帖暂时打不开，请稍后再试。'}, 503);
});

async function input (request: Request): Promise<Record<string, unknown>> {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new SocialError(415, 'JSON_REQUIRED', '请使用有效的书信格式。');
    }
    const reader = request.body?.getReader();
    if (!reader) throw new SocialError(400, 'INVALID_BODY', '这份内容没有填写完整。');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const result = await reader.read();
            if (result.done) break;
            length += result.value.byteLength;
            if (length > 16384) {
                await reader.cancel();
                throw new SocialError(413, 'BODY_TOO_LARGE', '这封信太长了。');
            }
            chunks.push(result.value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, position);
        position += chunk.length;
    }
    try {
        const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID');
        return value as Record<string, unknown>;
    } catch {
        throw new SocialError(400, 'INVALID_BODY', '这份内容没有填写完整。');
    }
}

socialRoutes.use('*', async (c, next) => {
    const session = c.get('session');
    if (!session?.user.id) return c.json({error: 'Unauthorized'}, 401);
    c.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(c.req.method)) {
        const origin = c.req.header('Origin');
        if (!origin || origin !== new URL(c.req.url).origin || c.req.header('Sec-Fetch-Site') === 'cross-site') {
            return c.json({error: 'ORIGIN_REJECTED', message: '请从日札页面重新操作。'}, 403);
        }
    }
    await next();
});

const service = (c: Context<SocialEnv>) => new SocialService(c.env.DB, c.get('session')!.user.id);
const field = (value: unknown) => typeof value === 'string' ? value : '';
const page = (value: string | undefined) => positiveInteger(value, 1, 10000);
const cursor = (value: string | undefined) => value === undefined ? undefined : positiveInteger(value, 0);

socialRoutes.get('/', async c => c.json(await service(c).overview()));
socialRoutes.get('/incoming', async c => c.json(await service(c).incoming(cursor(c.req.query('after')) || 0)));
socialRoutes.get('/search', async c => c.json(await service(c).search(c.req.query('handle') || '')));
socialRoutes.post('/requests', async c => c.json(await service(c).request(field((await input(c.req.raw)).userId))));
socialRoutes.post(
    '/requests/:id',
    async c => c.json(await service(c).resolveRequest(c.req.param('id'), field((await input(c.req.raw)).action)))
);
socialRoutes.delete('/friends/:id', async c => c.json(await service(c).removeFriend(c.req.param('id'))));
socialRoutes.post('/blocks/:id', async c => c.json(await service(c).block(c.req.param('id'), true)));
socialRoutes.delete('/blocks/:id', async c => c.json(await service(c).block(c.req.param('id'), false)));
socialRoutes.post('/reports', async c => c.json(await service(c).report(await input(c.req.raw))));
socialRoutes.get('/conversations', async c => c.json(await service(c).conversations(page(c.req.query('page')))));
socialRoutes.post(
    '/conversations',
    async c => c.json(await service(c).openConversation(field((await input(c.req.raw)).userId)))
);
socialRoutes.get(
    '/conversations/:id',
    async c =>
        c.json(
            await service(c).messages(c.req.param('id'), cursor(c.req.query('before')), cursor(c.req.query('after')))
        )
);
socialRoutes.post(
    '/conversations/:id/messages',
    async c => c.json(await service(c).send(c.req.param('id'), await input(c.req.raw)))
);
socialRoutes.put(
    '/conversations/:id/read',
    async c => c.json(await service(c).read(c.req.param('id'), Number((await input(c.req.raw)).seq)))
);
socialRoutes.put('/conversations/:id/mute', async c => {
    const value = (await input(c.req.raw)).muted;
    if (typeof value !== 'boolean') throw new SocialError(400, 'INVALID_PREFERENCE', '偏好设置无效。');
    return c.json(await service(c).mute(c.req.param('id'), value));
});
socialRoutes.get('/shares/:id', async c => c.json(await service(c).share(c.req.param('id'))));
socialRoutes.delete('/shares/:id', async c => c.json(await service(c).revokeShare(c.req.param('id'))));
socialRoutes.get('/profile/:id', async c => c.json(await service(c).profile(c.req.param('id'))));
socialRoutes.get('/notifications', async c => c.json(await service(c).notifications(page(c.req.query('page')))));
socialRoutes.put('/notifications/read', async c => c.json(await service(c).readNotifications(await input(c.req.raw))));
socialRoutes.put('/preferences', async c => c.json(await service(c).preferences(await input(c.req.raw))));
