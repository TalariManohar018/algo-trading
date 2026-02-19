// ============================================================
// ENGINE ROUTES — Start, stop, and control the trading engine
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { executionEngine } from '../engine/executionEngine';
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

export default router;
