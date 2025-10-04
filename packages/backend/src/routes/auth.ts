import {betterAuth} from 'better-auth';
import {username} from 'better-auth/plugins';
import {createPool} from 'mysql2/promise';
import {config} from '../config/index.js';

export const auth = betterAuth({
    database: createPool({
        host: config.env.mysqlDatabase,
        user: config.env.mysqlUser,
        password: config.env.mysqlPassword,
        database: 'registered_user',
        timezone: 'Z'
    }),
    emailAndPassword: {
        enabled: true
    },
    trustedOrigins: ['http://localhost:5173'],
    plugins: [
        username()
    ]
});
