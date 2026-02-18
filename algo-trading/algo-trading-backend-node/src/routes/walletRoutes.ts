import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { NotFoundError } from '../utils/errors';

const router = Router();

// GET /api/wallet — get user wallet
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user!.userId },
        });
        if (!wallet) throw new NotFoundError('Wallet not found');
        res.json({ success: true, data: wallet });
    })
);

export default router;
