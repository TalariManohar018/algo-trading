// ============================================================
// ENGINE ROUTES — Start, stop, and control the trading engine
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { executionEngine } from '../engine/executionEngine';
import { riskManagementService } from '../services/riskService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/engine/status — Get current engine status
 */
router.get('/status', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const status = executionEngine.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/start — Start the execution engine
 */
router.post('/start', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        await executionEngine.start();
        const status = executionEngine.getStatus();

        logger.info('Engine started via API');
        res.json({
            success: true,
            message: `Engine started — ${status.activeStrategies} strategies running`,
            data: status,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/stop — Stop the execution engine gracefully
 */
router.post('/stop', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        await executionEngine.stop();

        logger.info('Engine stopped via API');
        res.json({ success: true, message: 'Engine stopped' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/emergency-stop — Emergency stop (cancel all, square off)
 */
router.post('/emergency-stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const result = await executionEngine.emergencyStop(userId);

        logger.warn(`Emergency stop by user ${userId}`, result);
        res.json({
            success: true,
            message: 'Emergency stop executed',
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/strategy/:id/start — Add a strategy to the running engine
 */
router.post('/strategy/:id/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await executionEngine.addStrategy(id);

        res.json({
            success: true,
            message: `Strategy ${id} started`,
            data: executionEngine.getStatus(),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/strategy/:id/stop — Remove a strategy from the engine
 */
router.post('/strategy/:id/stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await executionEngine.removeStrategy(id);

        res.json({
            success: true,
            message: `Strategy ${id} stopped`,
            data: executionEngine.getStatus(),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/reload — Reload active strategies from DB
 */
router.post('/reload', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        await executionEngine.loadActiveStrategies();
        const status = executionEngine.getStatus();

        res.json({
            success: true,
            message: `Reloaded — ${status.activeStrategies} strategies`,
            data: status,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/engine/risk-status — Get current risk state + daily limits
 */
router.get('/risk-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const riskState = await riskManagementService.getRiskState(userId);
        const validation = await riskManagementService.validatePreTrading(userId);

        res.json({
            success: true,
            data: {
                isLocked: riskState.isLocked,
                lockReason: riskState.lockReason,
                dailyLoss: riskState.dailyLoss,
                dailyLossLimit: riskState.dailyLoss, // alias for frontend
                maxDailyLoss: process.env.MAX_DAILY_LOSS || 200,
                dailyTradeCount: riskState.dailyTradeCount,
                maxTradesPerDay: process.env.MAX_TRADES_PER_DAY || 5,
                consecutiveLosses: riskState.consecutiveLosses,
                maxConsecutiveLosses: process.env.CONSECUTIVE_LOSS_LIMIT || 3,
                maxRiskPerTrade: process.env.MAX_RISK_PER_TRADE || 100,
                tradingDate: riskState.tradingDate,
                preTradeChecks: validation.checks,
                readyToTrade: validation.ok,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/kill-switch — Instant kill: stop engine + cancel all + square off
 * This is the emergency button. Use when something goes wrong.
 */
router.post('/kill-switch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        logger.warn(`🔴 KILL SWITCH ACTIVATED by user ${userId}`);

        // 1. Emergency stop (cancels all orders + squares off)
        const result = await executionEngine.emergencyStop(userId);

        // 2. Lock the engine so it can't restart automatically
        await riskManagementService.lockEngine(userId, 'Kill switch activated by user');

        res.json({
            success: true,
            message: '🔴 Kill switch executed — all trades stopped, engine locked',
            data: {
                ...result,
                engineLocked: true,
                message: 'To resume trading, go to Settings and unlock the engine.',
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/engine/unlock — Manually unlock engine after risk breach
 */
router.post('/unlock', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        await riskManagementService.unlockEngine(userId);
        logger.info(`Engine unlocked by user ${userId}`);

        res.json({
            success: true,
            message: 'Engine unlocked. Pre-trade checks will run before next trade.',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
