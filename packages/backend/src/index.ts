import {Hono} from 'hono';
import {assessCardGeneration} from './config/index.js';
import {createDb} from './database/db.js';
import {auth} from './routes/auth.js';
import {buildCardWithMemory} from './routes/card.js';
import {getHistoryResponse} from './routes/history.js';
import type {Env} from './types.js';

type AuthInstance = ReturnType<typeof auth>;
type Session = Awaited<ReturnType<AuthInstance['api']['getSession']>>;

type Variables = {
    auth: AuthInstance;
    session: Session | null;
};

const app = new Hono<{Bindings: Env; Variables: Variables;}>();

const isPublicApiPath = (path: string): boolean => {
    return path.startsWith('/api/auth/') || path === '/api/health' || path === '/api/hello';
};

app.use('*', async (c, next) => {
    if (!c.req.path.startsWith('/api/') || c.req.path === '/api/health' || c.req.path === '/api/hello') {
        await next();
        return;
    }

    c.set('auth', auth(c.env));
    c.set('session', null);
    await next();
});

app.use('/api/*', async (c, next) => {
    if (isPublicApiPath(c.req.path)) {
        await next();
        return;
    }

    const session = await c.var.auth.api.getSession({
        headers: c.req.raw.headers
    });
    c.set('session', session);

    if (!session) {
        return c.json({error: 'Unauthorized'}, 401);
    }

    await next();
});

app.get('/api/health', (c) => {
    return c.json({ok: true});
});

app.get('/api/hello', (c) => {
    return c.json({ok: true, message: 'Hello from Hono!'});
});

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
    return c.var.auth.handler(c.req.raw);
});

app.get('/api/card', async (c) => {
    if (!assessCardGeneration(c.env).enabled) {
        return c.json({
            error: 'CARD_GEN_DISABLED',
            message: '文本模型尚未配置，暂时不能生成卡片。'
        }, 503);
    }

    try {
        const card = await buildCardWithMemory({
            db: createDb(c.env.DB),
            userId: c.var.session!.user.id,
            env: c.env,
            assetsBaseUrl: new URL(c.req.url).origin
        });
        if (!card.ok) {
            return c.json({error: card.error, message: card.message}, 503);
        }
        return c.json(card.card);
    } catch (error) {
        console.error('Failed to build card', error);
        return c.json({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'}, 500);
    }
});

app.get('/api/history', async (c) => {
    try {
        const data = await getHistoryResponse(createDb(c.env.DB), c.var.session!.user.id, c.req.query());
        return c.json(data);
    } catch (error) {
        console.error('Failed to fetch card history', error);
        return c.json({error: 'HISTORY_FAILED', message: '暂时无法读取学习历史。'}, 500);
    }
});

app.get('*', async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
