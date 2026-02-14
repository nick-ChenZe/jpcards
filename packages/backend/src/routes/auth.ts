// import {betterAuth} from 'better-auth';
// import {drizzleAdapter} from 'better-auth/adapters/drizzle';
// import {username} from 'better-auth/plugins';
// import {db} from '../database/d1Client.js';
// import * as schema from '../database/schema.js';

// export const auth = betterAuth({
//     database: drizzleAdapter(db, {
//         provider: 'sqlite',
//         schema: {
//             user: schema.user,
//             session: schema.session,
//             account: schema.account,
//             verification: schema.verification
//         }
//     }),
//     emailAndPassword: {
//         enabled: true
//     },
//     trustedOrigins: ['http://localhost:5173'],
//     plugins: [
//         username()
//     ]
// });

import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import {Env} from 'src/types.js';
import * as schema from '../database/schema.js';

// 假设你在 Cloudflare Workers 环境中获取到了 D1 的绑定 (env.DB)
// 注意：在 Next.js Edge Runtime 中获取 env 稍微有点不同
export const auth = (env: Env) =>
    betterAuth({
        database: drizzleAdapter(drizzle(env.DB), { // 传入 D1 实例
            provider: 'sqlite', // D1 本质是 SQLite
            schema: schema
        }),
        emailAndPassword: {
            enabled: true
        },
        trustedOrigins: ['http://localhost:5173'],
        plugins: [
            username()
        ]
    });
