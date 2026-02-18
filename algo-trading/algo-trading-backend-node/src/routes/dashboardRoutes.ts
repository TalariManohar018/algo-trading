import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard — aggregated dashboard data
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;

        // Parallel queries for dashboard
        const [wallet, strategies, openPositions, recentTrades, riskState, todayOrders] =
            await Promise.all([
                prisma.wallet.findUnique({ where: { userId } }),
                prisma.strategy.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
                prisma.position.findMany({ where: { userId, status: 'OPEN' } }),
                prisma.trade.findMany({
                    where: { userId },
                    orderBy: { exitTime: 'desc' },
                    take: 10,
                }),
                prisma.riskState.findUnique({ where: { userId } }),
                prisma.order.count({
                    where: {
                        userId,
                        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                    },
                }),
            ]);

        // Compute P&L today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTrades = await prisma.trade.findMany({
            where: { userId, exitTime: { gte: todayStart } },
        });
        const todayPnl = todayTrades.reduce((s: number, t: any) => s + t.pnl, 0);

        // Running strategies count
        const runningStrategies = strategies.filter((s: any) => s.status === 'RUNNING').length;

        res.json({
            success: true,
            data: {
                wallet: wallet ? {
                    balance: wallet.balance,
                    availableMargin: wallet.availableMargin,
                    usedMargin: wallet.usedMargin,
                    todayPnl,
                } : null,
                strategies: {
                    total: strategies.length,
                    running: runningStrategies,
                    items: strategies.slice(0, 5),
                },
                positions: {
                    open: openPositions.length,
                    items: openPositions,
                },
                trades: {
                    today: todayTrades.length,
                    todayPnl,
                    recent: recentTrades,
                },
                risk: riskState ? {
                    dailyLoss: riskState.dailyLoss,
                    isLocked: riskState.isLocked,
                    lockReason: riskState.lockReason,
                } : null,
                todayOrders,
            },
        });
    })
);

// GET /api/dashboard/equity-curve
router.get(
    '/equity-curve',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const days = parseInt(req.query.days as string) || 30;

        const since = new Date();
        since.setDate(since.getDate() - days);

        const trades = await prisma.trade.findMany({
            where: { userId, exitTime: { gte: since } },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true },
        });

        // Build cumulative equity curve from trades
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        const startBalance = (wallet?.balance || 100000) - trades.reduce((s: number, t: any) => s + t.pnl, 0);

        let running = startBalance;
        const curve = trades.map((t: any) => {
            running += t.pnl;
            return { date: t.exitTime, equity: running };
        });

        res.json({ success: true, data: curve });
    })
);

// GET /api/dashboard/audit-log
router.get(
    '/audit-log',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const logs = await prisma.auditLog.findMany({
            where: { userId: req.user!.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: logs });
    })
);

export default router;
