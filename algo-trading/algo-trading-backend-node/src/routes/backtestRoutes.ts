import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { backtestService, BacktestConfig } from '../services/backtestService';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

const router = Router();

const backtestSchema = z.object({
    strategyName: z.string(),
    strategyId: z.string(),
    parameters: z.record(z.number()),
    symbol: z.string(),
    timeframe: z.string(),
    startDate: z.string().transform(s => new Date(s)),
    endDate: z.string().transform(s => new Date(s)),
    initialCapital: z.number().positive().default(100000),
    positionSizePercent: z.number().min(1).max(100).default(20),
    slippageBps: z.number().min(0).max(100).default(5),
    commissionBps: z.number().min(0).max(100).default(3),
});

// POST /api/backtests — run a backtest
router.post(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const parsed = backtestSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const config = parsed.data as BacktestConfig;
        const result = await backtestService.run(req.user!.userId, config);

        res.status(201).json({ success: true, data: result });
    })
);

// GET /api/backtests — list user backtests
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 20;
        const history = await backtestService.getHistory(req.user!.userId, limit);
        res.json({ success: true, data: history });
    })
);

// GET /api/backtests/:id
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const result = await backtestService.getById(req.user!.userId, req.params.id);
        res.json({ success: true, data: result });
    })
);

export default router;
