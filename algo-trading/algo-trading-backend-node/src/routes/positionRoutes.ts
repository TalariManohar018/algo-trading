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

export default router;
