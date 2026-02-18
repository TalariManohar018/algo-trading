import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/trades — list user trades
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { limit = '50', offset = '0' } = req.query;

        const trades = await prisma.trade.findMany({
            where: { userId: req.user!.userId },
            orderBy: { exitTime: 'desc' },
            take: Math.min(parseInt(limit as string), 100),
            skip: parseInt(offset as string),
        });

        const total = await prisma.trade.count({ where: { userId: req.user!.userId } });

        res.json({ success: true, data: { trades, total } });
    })
);

// GET /api/trades/summary — aggregate trade stats
router.get(
    '/summary',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;

        const trades = await prisma.trade.findMany({ where: { userId } });
        const wins = trades.filter((t: any) => t.pnl > 0);
        const losses = trades.filter((t: any) => t.pnl <= 0);

        const summary = {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
            totalPnl: trades.reduce((s: number, t: any) => s + t.pnl, 0),
            avgWin: wins.length > 0 ? wins.reduce((s: number, t: any) => s + t.pnl, 0) / wins.length : 0,
            avgLoss: losses.length > 0 ? losses.reduce((s: number, t: any) => s + t.pnl, 0) / losses.length : 0,
            bestTrade: trades.length > 0 ? Math.max(...trades.map((t: any) => t.pnl)) : 0,
            worstTrade: trades.length > 0 ? Math.min(...trades.map((t: any) => t.pnl)) : 0,
        };

        res.json({ success: true, data: summary });
    })
);

export default router;
