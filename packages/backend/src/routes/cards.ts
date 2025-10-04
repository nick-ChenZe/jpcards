import type {Card, CardCreate, Difficulty} from '@jpcards/shared';
import {Request, Response, Router} from 'express';
import {openDb} from '../database/index.js';

const router = Router();

// GET /api/cards
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = await openDb();
        const cards = await db.all('SELECT * FROM cards');
        res.json(cards as any as Card[]);
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).json({error: 'Failed to fetch cards'});
    }
});

// POST /api/cards
router.post('/', async (req: Request, res: Response) => {
    const {japanese, reading, meaning, difficulty} = req.body as CardCreate;
    const diff: Difficulty = difficulty ?? 'Normal';
    try {
        const db = await openDb();
        const result = await db.run(
            'INSERT INTO cards (japanese, reading, meaning, difficulty) VALUES (?, ?, ?, ?)',
            [japanese, reading, meaning, diff]
        );
        res.json(result);
    } catch (error) {
        console.error('Error creating card:', error);
        res.status(500).json({error: 'Failed to create card'});
    }
});

export default router;
