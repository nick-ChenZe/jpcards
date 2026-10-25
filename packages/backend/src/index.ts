import {Hono} from 'hono';
import {createDb} from './database/db.js';
import {readCardQuota, reserveCardQuota} from './quota/cardQuota.js';
import {auth, AuthConfigError} from './routes/auth.js';
import {buildCardWithMemory} from './routes/card.js';
import {getHistoryCardResponse, getHistoryResponse} from './routes/history.js';
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

    try {
        c.set('auth', auth(c.env, c.req.url));
        c.set('session', null);
    } catch (error) {
        if (error instanceof AuthConfigError) {
            return c.json({
                error: 'AUTH_NOT_CONFIGURED',
                message: '登录服务还没配好，暂时不能注册或登录。'
            }, 503);
        }
        console.error('Auth init failed', error);
        return c.json({
            error: 'AUTH_NOT_CONFIGURED',
            message: '登录服务暂时不可用。'
        }, 503);
    }

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

app.get('/api/me/quota', async (c) => {
    try {
        const quota = await readCardQuota(c.env.DB, c.var.session!.user.id, new Date());
        return c.json(quota);
    } catch (error) {
        console.error('Failed to read card quota', error);
        return c.json({error: 'QUOTA_FAILED', message: '暂时无法读取今日额度。'}, 500);
    }
});

app.get('/api/card', async (c) => {
    const userId = c.var.session!.user.id;
    try {
        const reserved = await reserveCardQuota(c.env.DB, userId, new Date());
        if (!reserved.ok) {
            return c.json({error: reserved.code, message: reserved.message}, 429);
        }
        const card = await buildCardWithMemory({
            db: createDb(c.env.DB),
            userId,
            env: c.env,
            assetsBaseUrl: new URL(c.req.url).origin
        });
        return c.json(card.card);
    } catch (error) {
        console.error('Failed to build card', error);
        return c.json({error: 'CARD_GEN_FAILED', message: '生成失败，请稍后再试。'}, 500);
    }
});

app.get('/api/history/:id', async (c) => {
    try {
        const card = await getHistoryCardResponse(createDb(c.env.DB), c.var.session!.user.id, c.req.param('id'));
        if (!card) {
            return c.json({error: 'CARD_NOT_FOUND', message: '找不到这张卡片。'}, 404);
        }
        return c.json(card);
    } catch (error) {
        console.error('Failed to fetch card', error);
        return c.json({error: 'HISTORY_FAILED', message: '暂时无法读取这张卡片。'}, 500);
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
