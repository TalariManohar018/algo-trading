import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { strategyRegistry } from '../strategies';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

const conditionSchema = z.object({
    id: z.string().optional(),
    indicatorType: z.string(),
    conditionType: z.string(),
    value: z.number(),
    logic: z.string().optional(),
    period: z.number().optional(),
});

const createStrategySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional().default(''),
    symbol: z.string().min(1),
    instrumentType: z.string().optional().default('FUTURE'),
    timeframe: z.enum(['ONE_MINUTE', 'FIVE_MINUTES', 'FIFTEEN_MINUTES', 'THIRTY_MINUTES', 'ONE_HOUR', 'ONE_DAY']),
    quantity: z.number().int().positive(),
    orderType: z.enum(['MARKET', 'LIMIT']).optional().default('MARKET'),
    productType: z.enum(['CNC', 'MIS', 'NRML']).default('MIS'),
    entryConditions: z.array(conditionSchema).optional().default([]),
    exitConditions: z.array(conditionSchema).optional().default([]),
    maxTradesPerDay: z.number().int().positive().optional().default(5),
    tradingWindow: z.object({
        startTime: z.string(),
        endTime: z.string(),
    }).optional(),
    squareOffTime: z.string().optional(),
    riskConfig: z.object({
        maxLossPerTrade: z.number().optional(),
        maxProfitTarget: z.number().optional(),
        stopLossPercent: z.number().optional(),
        takeProfitPercent: z.number().optional(),
    }).optional(),
    // Legacy fields (from old strategy registry flow)
    strategyType: z.string().optional(),
    parameters: z.record(z.number()).optional(),
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

        const d = parsed.data;

        // If legacy strategyType flow is used, validate parameters
        if (d.strategyType && d.parameters) {
            const impl = strategyRegistry.getOrThrow(d.strategyType);
            try {
                impl.validateParameters(d.parameters);
            } catch (e: any) {
                throw new ValidationError(e.message || 'Invalid parameters for this strategy');
            }
        }

        // Build a parameters JSON that stores all the rich data
        const parametersJson = JSON.stringify({
            ...(d.parameters || {}),
            instrumentType: d.instrumentType,
            orderType: d.orderType,
            entryConditions: d.entryConditions,
            exitConditions: d.exitConditions,
            riskConfig: d.riskConfig,
        });

        const strategy = await prisma.strategy.create({
            data: {
                userId: req.user!.userId,
                name: d.name,
                description: d.description || '',
                strategyType: d.strategyType || 'CUSTOM',
                symbol: d.symbol,
                timeframe: d.timeframe as any,
                parameters: parametersJson,
                quantity: d.quantity,
                maxTradesPerDay: d.maxTradesPerDay || 5,
                maxLossPerTrade: d.riskConfig?.maxLossPerTrade,
                stopLossPercent: d.riskConfig?.stopLossPercent,
                takeProfitPercent: d.riskConfig?.takeProfitPercent,
                tradingStartTime: d.tradingWindow?.startTime,
                tradingEndTime: d.tradingWindow?.endTime,
                squareOffTime: d.squareOffTime,
                status: 'CREATED',
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

// POST /api/strategies/:id/test-execute — Force execute strategy once for testing
router.post(
    '/:id/test-execute',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const strategy = await prisma.strategy.findUnique({ where: { id: req.params.id } });
        if (!strategy || strategy.userId !== req.user!.userId) {
            throw new NotFoundError('Strategy not found');
        }

        // decide whether to close immediately or leave position open
        const { closeImmediately = false } = req.body;

        // Simulate entry
        const entryPrice = 1000 + Math.random() * 2000;
        const quantity = strategy.quantity;
        const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';
        
        const stopLoss = strategy.stopLossPercent 
            ? entryPrice * (1 - strategy.stopLossPercent / 100)
            : null;
        const takeProfit = strategy.takeProfitPercent
            ? entryPrice * (1 + strategy.takeProfitPercent / 100)
            : null;

        const now = new Date();

        // Create OPEN position first
        const position = await prisma.position.create({
            data: {
                userId: req.user!.userId,
                strategyId: strategy.id,
                symbol: strategy.symbol,
                exchange: 'NSE',
                side: positionSide,
                quantity,
                entryPrice,
                currentPrice: entryPrice,
                stopLoss,
                takeProfit,
                status: 'OPEN',
            } as any,
        });

        // Update wallet margin
        const marginUsed = entryPrice * quantity * 0.2; // 20% margin
        await prisma.wallet.update({
            where: { userId: req.user!.userId },
            data: {
                usedMargin: { increment: marginUsed },
                availableMargin: { decrement: marginUsed },
            },
        });

        // If closeImmediately is true, close the position and create trade
        if (closeImmediately) {
            const duration = Math.floor(Math.random() * 1800) + 300; // 5-35 minutes
            const exitPrice = entryPrice + (Math.random() - 0.45) * 100; // Slightly favor wins
            const pnl = positionSide === 'LONG'
                ? (exitPrice - entryPrice) * quantity
                : (entryPrice - exitPrice) * quantity;
            const pnlPercent = (pnl / (entryPrice * quantity)) * 100;

            const entryTime = new Date(now.getTime() - duration * 1000);

            // Close position
            await prisma.position.update({
                where: { id: position.id },
                data: {
                    status: 'CLOSED',
                    exitPrice,
                    realizedPnl: pnl,
                    currentPrice: exitPrice,
                    closedAt: now,
                },
            });

            // Create trade record
            const trade = await prisma.trade.create({
                data: {
                    userId: req.user!.userId,
                    strategyId: strategy.id,
                    symbol: strategy.symbol,
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
            });

            // Release margin and update wallet
            await prisma.wallet.update({
                where: { userId: req.user!.userId },
                data: {
                    balance: { increment: pnl },
                    realizedPnl: { increment: pnl },
                    usedMargin: { decrement: marginUsed },
                    availableMargin: { increment: marginUsed },
                },
            });

            res.json({
                success: true,
                message: `Test trade executed and closed for ${strategy.name}`,
                data: {
                    ...trade,
                    strategyName: strategy.name,
                },
            });
        } else {
            // Return open position
            res.json({
                success: true,
                message: `Test position opened for ${strategy.name}. You can see it in Positions page.`,
                data: {
                    ...position,
                    strategyName: strategy.name,
                },
            });
        }
    })
);

export default router;
