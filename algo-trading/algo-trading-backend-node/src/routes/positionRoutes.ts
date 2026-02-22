import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { NotFoundError } from '../utils/errors';

const router = Router();

// GET /api/positions — list user positions
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { status = 'OPEN' } = req.query;

        const whereClause: any = {
            userId: req.user!.userId,
        };

        // Only filter by status if not 'ALL'
        if (status !== 'ALL') {
            whereClause.status = status;
        }

        const positions = await prisma.position.findMany({
            where: whereClause,
            include: {
                strategy: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { openedAt: 'desc' },
        });

        // Transform to include strategyName
        const transformedPositions = positions.map(pos => ({
            ...pos,
            strategyName: pos.strategy?.name || 'Unknown',
        }));

        res.json({ success: true, data: transformedPositions });
    })
);

// GET /api/positions/:id
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const position = await prisma.position.findUnique({ where: { id: req.params.id } });
        if (!position || position.userId !== req.user!.userId) {
            throw new NotFoundError('Position not found');
        }
        res.json({ success: true, data: position });
    })
);

// POST /api/positions/:id/close — Close a position manually
router.post(
    '/:id/close',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const position = await prisma.position.findUnique({ where: { id: req.params.id } });
        if (!position || position.userId !== req.user!.userId) {
            throw new NotFoundError('Position not found');
        }
        if (position.status === 'CLOSED') {
            throw new Error('Position already closed');
        }

        const exitPrice = req.body.exitPrice || position.currentPrice;
        const pnl = position.side === 'LONG'
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;
        const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
        const duration = Math.floor((Date.now() - new Date(position.openedAt).getTime()) / 1000);

        // Close position
        const closedPosition = await prisma.position.update({
            where: { id: req.params.id },
            data: {
                status: 'CLOSED',
                exitPrice,
                realizedPnl: pnl,
                currentPrice: exitPrice,
                closedAt: new Date(),
            },
        });

        // Create trade record
        await prisma.trade.create({
            data: {
                userId: req.user!.userId,
                strategyId: position.strategyId,
                symbol: position.symbol,
                exchange: position.exchange,
                side: position.side === 'LONG' ? 'BUY' : 'SELL',
                quantity: position.quantity,
                entryPrice: position.entryPrice,
                exitPrice,
                pnl,
                pnlPercent,
                entryTime: position.openedAt,
                exitTime: new Date(),
                duration,
            },
        });

        // Update wallet
        await prisma.wallet.update({
            where: { userId: req.user!.userId },
            data: {
                balance: { increment: pnl },
                realizedPnl: { increment: pnl },
            },
        });

        res.json({
            success: true,
            message: `Position closed. P&L: ₹${pnl.toFixed(2)}`,
            data: closedPosition,
        });
    })
);

export default router;
