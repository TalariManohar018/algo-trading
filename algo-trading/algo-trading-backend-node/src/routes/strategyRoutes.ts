import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { strategyRegistry } from '../strategies';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

const createStrategySchema = z.object({
    name: z.string().min(1).max(100),
    strategyType: z.string(),
    symbol: z.string().min(1),
    timeframe: z.enum(['ONE_MINUTE', 'FIVE_MINUTES', 'FIFTEEN_MINUTES', 'THIRTY_MINUTES', 'ONE_HOUR', 'ONE_DAY']),
    parameters: z.record(z.number()),
    productType: z.enum(['CNC', 'MIS', 'NRML']).default('MIS'),
    quantity: z.number().int().positive(),
});

// GET /api/strategies/available — list available strategy types
router.get(
    '/available',
    authenticate,
    asyncHandler(async (_req: Request, res: Response) => {
        const strategies = strategyRegistry.listAll();
        res.json({ success: true, data: strategies });
    })
);

// POST /api/strategies — create a user strategy
router.post(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const parsed = createStrategySchema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const { strategyType } = parsed.data;
        const impl = strategyRegistry.getOrThrow(strategyType);
        try {
            impl.validateParameters(parsed.data.parameters);
        } catch (e: any) {
            throw new ValidationError(e.message || 'Invalid parameters for this strategy');
        }

        const strategy = await prisma.strategy.create({
            data: {
                userId: req.user!.userId,
                name: parsed.data.name,
                strategyType,
                symbol: parsed.data.symbol,
                timeframe: parsed.data.timeframe as any,
                parameters: parsed.data.parameters,
                quantity: parsed.data.quantity,
                status: 'STOPPED',
            },
        });

        res.status(201).json({ success: true, data: strategy });
    })
);

// GET /api/strategies — list user strategies
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategies = await prisma.strategy.findMany({
            where: { userId: req.user!.userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: strategies });
    })
);

// GET /api/strategies/:id
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategy = await prisma.strategy.findUnique({ where: { id: req.params.id } });
        if (!strategy || strategy.userId !== req.user!.userId) {
            throw new NotFoundError('Strategy not found');
        }
        res.json({ success: true, data: strategy });
    })
);

// PATCH /api/strategies/:id/start
router.patch(
    '/:id/start',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategy = await prisma.strategy.findUnique({ where: { id: req.params.id } });
        if (!strategy || strategy.userId !== req.user!.userId) {
            throw new NotFoundError('Strategy not found');
        }

        const updated = await prisma.strategy.update({
            where: { id: req.params.id },
            data: { status: 'RUNNING' },
        });

        res.json({ success: true, data: updated });
    })
);

// PATCH /api/strategies/:id/stop
router.patch(
    '/:id/stop',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategy = await prisma.strategy.findUnique({ where: { id: req.params.id } });
        if (!strategy || strategy.userId !== req.user!.userId) {
            throw new NotFoundError('Strategy not found');
        }

        const updated = await prisma.strategy.update({
            where: { id: req.params.id },
            data: { status: 'STOPPED' },
        });

        res.json({ success: true, data: updated });
    })
);

// DELETE /api/strategies/:id
router.delete(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategy = await prisma.strategy.findUnique({ where: { id: req.params.id } });
        if (!strategy || strategy.userId !== req.user!.userId) {
            throw new NotFoundError('Strategy not found');
        }
        if (strategy.status === 'RUNNING') {
            throw new ValidationError('Cannot delete a running strategy');
        }

        await prisma.strategy.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Strategy deleted' });
    })
);

export default router;
