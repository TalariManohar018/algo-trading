import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /api/demo/generate-trades — Create sample trades for testing
 */
router.post(
    '/generate-trades',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const { count = 5 } = req.body;

        // Get user's strategies to link trades to them
        const strategies = await prisma.strategy.findMany({
            where: { userId },
            take: 5,
        });

        const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL', 'WIPRO'];
        const sides = ['BUY', 'SELL'];
        const createdTrades = [];

        for (let i = 0; i < Math.min(count, 10); i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const side = sides[Math.floor(Math.random() * sides.length)];
            const entryPrice = 1000 + Math.random() * 2000;
            const exitPrice = entryPrice + (Math.random() - 0.45) * 200; // Slightly favor wins
            const quantity = Math.floor(Math.random() * 10) + 1;
            const pnl = (exitPrice - entryPrice) * quantity * (side === 'BUY' ? 1 : -1);
            const pnlPercent = (pnl / (entryPrice * quantity)) * 100;
            const duration = Math.floor(Math.random() * 3600) + 60;

            const now = new Date();
            const entryTime = new Date(now.getTime() - duration * 1000);

            // Randomly assign to a strategy or leave null
            const strategyId = strategies.length > 0 && Math.random() > 0.3
                ? strategies[Math.floor(Math.random() * strategies.length)].id
                : null;

            const trade = await prisma.trade.create({
                data: {
                    userId,
                    strategyId,
                    symbol,
                    exchange: 'NSE',
                    side,
                    quantity,
                    entryPrice,
                    exitPrice,
                    pnl,
                    pnlPercent,
                    entryTime,
                    exitTime: now,
                    duration,
                },
                include: {
                    strategy: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

            createdTrades.push({
                ...trade,
                strategyName: trade.strategy?.name || 'Manual Trade',
            });
        }

        res.json({
            success: true,
            message: `Generated ${createdTrades.length} demo trades`,
            data: createdTrades,
        });
    })
);

/**
 * POST /api/demo/generate-positions — Create sample positions for testing
 */
router.post(
    '/generate-positions',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const { count = 3 } = req.body;

        // Get user's strategies to link positions to them
        const strategies = await prisma.strategy.findMany({
            where: { userId },
            take: 5,
        });

        const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL', 'WIPRO'];
        const sides: Array<'LONG' | 'SHORT'> = ['LONG', 'SHORT'];
        const createdPositions = [];

        for (let i = 0; i < Math.min(count, 5); i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const side = sides[Math.floor(Math.random() * sides.length)];
            const entryPrice = 1000 + Math.random() * 2000;
            const currentPrice = entryPrice + (Math.random() - 0.5) * 100;
            const quantity = Math.floor(Math.random() * 10) + 1;
            const unrealizedPnl = (currentPrice - entryPrice) * quantity * (side === 'LONG' ? 1 : -1);
            const stopLoss = side === 'LONG' 
                ? entryPrice * 0.98 
                : entryPrice * 1.02;
            const takeProfit = side === 'LONG' 
                ? entryPrice * 1.05 
                : entryPrice * 0.95;

            // Randomly assign to a strategy or leave null
            const strategyId = strategies.length > 0 && Math.random() > 0.3
                ? strategies[Math.floor(Math.random() * strategies.length)].id
                : null;

            const position = await prisma.position.create({
                data: {
                    userId,
                    strategyId,
                    symbol,
                    exchange: 'NSE',
                    side,
                    quantity,
                    entryPrice,
                    currentPrice,
                    stopLoss,
                    takeProfit,
                    unrealizedPnl,
                    status: 'OPEN',
                } as any,
                include: {
                    strategy: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

            createdPositions.push({
                ...position,
                strategyName: position.strategy?.name || 'Manual Trade',
            });
        }

        res.json({
            success: true,
            message: `Generated ${createdPositions.length} demo positions`,
            data: createdPositions,
        });
    })
);

/**
 * DELETE /api/demo/clear-all — Clear all demo data
 */
router.delete(
    '/clear-all',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;

        const [tradesDeleted, positionsDeleted] = await Promise.all([
            prisma.trade.deleteMany({ where: { userId } }),
            prisma.position.deleteMany({ where: { userId } }),
        ]);

        res.json({
            success: true,
            message: `Cleared ${tradesDeleted.count} trades and ${positionsDeleted.count} positions`,
        });
    })
);

export default router;
