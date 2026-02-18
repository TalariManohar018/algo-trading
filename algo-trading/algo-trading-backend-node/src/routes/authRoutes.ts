import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

const router = Router();

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    fullName: z.string().min(2).max(50),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// POST /api/auth/register
router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req: Request, res: Response) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await authService.register(parsed.data);
        res.status(201).json({ success: true, data: result });
    })
);

// POST /api/auth/login
router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req: Request, res: Response) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await authService.login(parsed.data);
        res.json({ success: true, data: result });
    })
);

// GET /api/auth/me
router.get(
    '/me',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const profile = await authService.getProfile(req.user!.userId);
        res.json({ success: true, data: profile });
    })
);

export default router;
