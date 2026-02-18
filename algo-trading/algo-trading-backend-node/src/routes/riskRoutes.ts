import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { riskManagementService } from '../services/riskService';

const router = Router();

// GET /api/risk — get risk state
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const state = await riskManagementService.getRiskState(req.user!.userId);
        res.json({ success: true, data: state });
    })
);

// POST /api/risk/unlock — unlock engine
router.post(
    '/unlock',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        await riskManagementService.unlockEngine(req.user!.userId);
        res.json({ success: true, message: 'Engine unlocked' });
    })
);

// POST /api/risk/reset — reset daily counters
router.post(
    '/reset',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        await riskManagementService.resetDailyCounters(req.user!.userId);
        res.json({ success: true, message: 'Daily counters reset' });
    })
);

export default router;
