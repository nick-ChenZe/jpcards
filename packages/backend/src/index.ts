import {type Context, Hono} from 'hono';
import {
    clientIpFromHeaders,
    consumeRegisterAttempt,
    isRegisterRequest,
    readRegisterEmail
} from './auth/registerRateLimit.js';
import {isAdminUserId} from './config/admin.js';
import {listRecentCardCreatedAt} from './database/cardHistory.js';
import {createDb} from './database/db.js';
import {readCardQuota} from './quota/cardQuota.js';
import {getAdminCardsResponse, logAdminCardList} from './routes/adminCards.js';
import {auth, AuthConfigError} from './routes/auth.js';
import {generateCard} from './routes/generateCard.js';
import {getHistoryCardResponse, getHistoryResponse} from './routes/history.js';
import type {Env} from './types.js';
import {ADMIN_FORBIDDEN_MESSAGE, CARD_METHOD_NOT_ALLOWED_MESSAGE, REGISTER_UNAVAILABLE_MESSAGE} from './userCopy.js';
import {countStreakDays} from './utils/streak.js';

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

async function enforceRegisterRateLimit (c: Context<{Bindings: Env; Variables: Variables;}>): Promise<Response | null> {
    try {
        const decision = await consumeRegisterAttempt(c.env.DB, {
            ip: clientIpFromHeaders(c.req.raw.headers),
            email: await readRegisterEmail(c.req.raw),
            now: new Date()
        });
        if (decision.ok) {
            return null;
        }
        return c.json(
            {
                error: 'REGISTER_RATE_LIMITED',
                code: 'REGISTER_RATE_LIMITED',
                message: decision.message
            },
            429,
            {
                'Retry-After': String(decision.retryAfterSeconds)
            }
        );
    } catch (error) {
        console.error('Register rate limit failed', error);
        return c.json({
            error: 'REGISTER_UNAVAILABLE',
            message: REGISTER_UNAVAILABLE_MESSAGE
        }, 503);
    }
}

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    if (isRegisterRequest(c.req.method, new URL(c.req.url).pathname)) {
        const blocked = await enforceRegisterRateLimit(c);
        if (blocked) {
            return blocked;
        }
    }
    return c.var.auth.handler(c.req.raw);
});

app.get('/api/me', async (c) => {
    const current = c.var.session!.user;
    const username = 'username' in current && typeof current.username === 'string'
        ? current.username
        : null;
    let streakDays = 0;
    try {
        const createdAt = await listRecentCardCreatedAt(createDb(c.env.DB), current.id);
        streakDays = countStreakDays(createdAt, new Date());
    } catch (error) {
        console.error('Failed to read streak', error);
    }
    return c.json({
        id: current.id,
        email: current.email,
        name: current.name,
        username,
        isAdmin: isAdminUserId(c.env.ADMIN_USER_IDS, current.id),
        streakDays
    });
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

// GET 不能生卡。浏览器和边缘会重试 GET，第二次 reserve 可能来不及退款。
app.get('/api/card', (c) => {
    c.header('Allow', 'POST');
    return c.json({error: 'METHOD_NOT_ALLOWED', message: CARD_METHOD_NOT_ALLOWED_MESSAGE}, 405);
});

app.post('/api/card', async (c) => {
    const result = await generateCard({
        database: c.env.DB,
        userId: c.var.session!.user.id,
        env: c.env,
        assetsBaseUrl: new URL(c.req.url).origin,
        idempotencyKey: c.req.header('Idempotency-Key'),
        now: new Date()
    });
    return c.json(result.body, result.status as 200);
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

app.get('/api/admin/cards', async (c) => {
    // 只认 ADMIN_USER_IDS。未设置或不在名单里时，在查库之前返回 403。这里只读，不改卡片。
    const adminId = c.var.session!.user.id;
    if (!isAdminUserId(c.env.ADMIN_USER_IDS, adminId)) {
        return c.json({error: 'FORBIDDEN', message: ADMIN_FORBIDDEN_MESSAGE}, 403);
    }

    try {
        const data = await getAdminCardsResponse(createDb(c.env.DB), c.req.query());
        logAdminCardList(adminId, data.items.length);
        return c.json(data);
    } catch (error) {
        console.error('Failed to fetch admin cards', error);
        return c.json({error: 'ADMIN_CARDS_FAILED', message: '暂时无法读取全部卡片。'}, 500);
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
