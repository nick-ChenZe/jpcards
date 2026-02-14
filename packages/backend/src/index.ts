import {Hono} from 'hono';
import {auth} from './routes/auth.js';
import {buildCardDemo, buildCardWithMemory} from './routes/card.js';
import {getHistoryResponse} from './routes/history.js';
import {Env} from './types.js';

type AuthInstance = ReturnType<typeof auth>;
type Session = Awaited<ReturnType<AuthInstance['api']['getSession']>>;

type Variables = {
    auth: AuthInstance;
    session: Session | null;
};

const app = new Hono<{Bindings: Env; Variables: Variables;}>();

const isPublicApiPath = (path: string): boolean => path.startsWith('/api/auth/');

app.use('*', async (c, next) => {
    const authInstance = auth(c.env);
    c.set('auth', authInstance);
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

app.get('/api/hello', (c) => {
    return c.json({message: 'Hello from Hono!'});
});

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
    return c.var.auth.handler(c.req.raw);
});

app.get('/api/card', async (c) => {
    try {
        const session = c.var.session!;
        const assetsBaseUrl = new URL(c.req.url).origin;
        const card = await buildCardWithMemory(session.user.id, c.env, assetsBaseUrl);
        return c.json(card);
    } catch (error) {
        console.error('Failed to build card:', error);
        return c.json({
            error: 'Failed to build card',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

app.get('/api/history', async (c) => {
    try {
        const query = c.req.query();
        const data = await getHistoryResponse(c.var.session!.user.id, query);
        return c.json(data);
    } catch (error) {
        console.error('Failed to fetch card history:', error);
        return c.json({
            error: 'Failed to fetch card history',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

app.get('*', async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
