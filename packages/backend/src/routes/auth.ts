import { betterAuth } from "better-auth";
import { createPool } from "mysql2/promise";
import { username } from "better-auth/plugins"
import {Request, Response, Router} from "express";
import {config} from "../config/index.js";

export const auth = betterAuth({
    database: createPool({
        host: config.env.mysqlDatabase,
        user: config.env.mysqlUser,
        password: config.env.mysqlPassword,
        database: "registered_user",
        timezone: "Z", 
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [ 
        username() 
    ] 
});

const router = Router()

// POST /api/login
router.post('/login', async (req: Request, res: Response) => {
    const {username, password} = req.body;
    const data = await auth.api.signInUsername({
        body: {
            username,
            password
        },
    });

    if (!data?.user) {
        res.status(401).json({error: 'Invalid username or password'});
        return;
    }
    
    res.json({token: data.token});
});

router.post('/signup', async (req: Request, res: Response) => {
    const {email, username, password} = req.body;

    if (!username) {
        res.status(400).json({error: 'Username is required'});
        return;
    }

    if (!email) {
        res.status(400).json({error: 'Email is required'});
        return;
    }

    if (!password) {
        res.status(400).json({error: 'Password is required'});
        return;
    }

    const response = await auth.api.isUsernameAvailable({
        body: {
            username,
        },
    });

    if (!response.available) {
        res.status(400).json({error: 'Username is not available'});
        return;
    }

    const data = await auth.api.signUpEmail({
        body: {
            email,
            name: username,
            password,
            username,
            displayUsername: username,
        },
    });

    res.json({token: data.token});
})

export default router;