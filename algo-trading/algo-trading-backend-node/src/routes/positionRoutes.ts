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

        const positions = await prisma.position.findMany({
            where: {
                userId: req.user!.userId,
                status: status as any,
            },
            orderBy: { openedAt: 'desc' },
        });

        res.json({ success: true, data: positions });
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

export default router;
