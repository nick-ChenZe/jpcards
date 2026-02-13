import {fromNodeHeaders, toNodeHandler} from 'better-auth/node';
import cors from 'cors';
import express, {Request, Response} from 'express';
import {runMigrations} from './src/database/index.js';
import {auth} from './src/routes/auth.js';
import imageRouter from './src/routes/image.js';
import audioRouter from './src/routes/audio.js';
import cardRouter from './src/routes/card.js';
import historyRouter from './src/routes/history.js';

const app = express();
const port = 8000;

// app.use(
//   cors({
//     origin: "http://localhost:5173", // Replace with your frontend's origin
//     methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
//     credentials: true, // Allow credentials (cookies, authorization headers, etc.)
//   })
// );

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the backend!');
});

runMigrations().catch((err) => {
    console.error('Failed to run migrations:', err);
});

app.all('/api/*splat', async (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api/card')) {
        return next();
    }
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers)
    });
    if (!session) {
        return res.status(401).json({error: 'Unauthorized'});
    }
    return next();
});

app.use('/api/image', imageRouter);
app.use('/api/audio', audioRouter);
app.use('/api/card', cardRouter);
app.use('/api/history', historyRouter);

app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
