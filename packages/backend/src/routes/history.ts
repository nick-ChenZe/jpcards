import {Request, Response, Router} from 'express';
import {fromNodeHeaders} from 'better-auth/node';
import {auth} from './auth.js';
import {getCardHistory, getCardHistoryCount} from '../database/cardHistory.js';

const router = Router();

/**
 * GET /api/history
 * 获取当前用户的卡片浏览历史（分页）
 * Query: ?page=1&pageSize=20
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });
        if (!session) {
            res.status(401).json({error: 'Unauthorized'});
            return;
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
        const offset = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            getCardHistory(session.user.id, pageSize, offset),
            getCardHistoryCount(session.user.id)
        ]);

        res.json({
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Failed to fetch card history:', error);
        res.status(500).json({
            error: 'Failed to fetch card history',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
