import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimiter';
import { riskManagementService } from '../services/riskService';
import { OrderExecutor } from '../engine/orderExecutor';
import { getBrokerInstance } from '../engine/brokerFactory';
import { z } from 'zod';
import { ValidationError, NotFoundError, RiskBreachError } from '../utils/errors';

const router = Router();

const placeOrderSchema = z.object({
    symbol: z.string().min(1),
    side: z.enum(['BUY', 'SELL']),
    type: z.enum(['MARKET', 'LIMIT', 'SL', 'SL_M']),
    productType: z.enum(['CNC', 'MIS', 'NRML']).default('MIS'),
    quantity: z.number().int().positive(),
    price: z.number().positive().optional(),
    triggerPrice: z.number().positive().optional(),
    strategyId: z.string().optional(),
});

// POST /api/orders — place a new order
router.post(
    '/',
    authenticate,
    orderLimiter,
    asyncHandler(async (req: Request, res: Response) => {
        const parsed = placeOrderSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const { symbol, side, type, productType, quantity, price, triggerPrice, strategyId } = parsed.data;

        // Estimate order value for risk check
        const broker = getBrokerInstance();

        let estimatedPrice = price || 0;
        if (!estimatedPrice) {
            estimatedPrice = await broker.getCurrentPrice(symbol);
        }
        const orderValue = estimatedPrice * quantity;

        // Risk check
        const riskCheck = await riskManagementService.checkPreOrder(req.user!.userId, orderValue);
        if (!riskCheck.allowed) {
            throw new RiskBreachError(riskCheck.reason || 'Risk check failed');
        }

        // Create the order executor
        const executor = new OrderExecutor(broker);

        const order = await executor.executeOrder({
            userId: req.user!.userId,
            symbol,
            side: side as 'BUY' | 'SELL',
            orderType: (type === 'SL_M' ? 'SL-M' : type) as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
            quantity,
            limitPrice: price,
            triggerPrice,
            strategyId: strategyId || undefined,
        });

        res.status(201).json({ success: true, data: order });
    })
);

// GET /api/orders — list user orders
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { status, limit = '50', offset = '0' } = req.query;

        const where: any = { userId: req.user!.userId };
        if (status) where.status = status;

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(parseInt(limit as string), 100),
            skip: parseInt(offset as string),
        });

        res.json({ success: true, data: orders });
    })
);

// GET /api/orders/:id
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.userId !== req.user!.userId) {
            throw new NotFoundError('Order not found');
        }
        res.json({ success: true, data: order });
    })
);

// DELETE /api/orders/:id — cancel an order
router.delete(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.userId !== req.user!.userId) {
            throw new NotFoundError('Order not found');
        }
        if (order.status !== 'PENDING' && order.status !== 'PLACED') {
            throw new ValidationError('Only pending/placed orders can be cancelled');
        }

        if (order.brokerOrderId) {
            const broker = getBrokerInstance();
            await broker.cancelOrder(order.brokerOrderId);
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' },
        });

        res.json({ success: true, data: updated });
    })
);

export default router;
