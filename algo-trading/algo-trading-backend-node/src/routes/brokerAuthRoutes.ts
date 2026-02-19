// ============================================================
// BROKER AUTH ROUTES — Login/logout to Angel One SmartAPI
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../config/database';
import { env } from '../config/env';
import { AngelOneBrokerService } from '../services/angelOneBroker';
import { getBrokerInstance, setBrokerInstance } from '../engine/brokerFactory';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/broker/login — Login to Angel One with API credentials
 */
router.post('/login', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { apiKey, clientId, mpin, totpSecret } = req.body;
        const userId = req.user!.userId;

        if (!apiKey || !clientId || !mpin || !totpSecret) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: apiKey, clientId, mpin, totpSecret',
            });
        }

        // Create Angel One broker instance and login
        const broker = new AngelOneBrokerService({ apiKey, clientId, mpin, totpSecret });
        const tokens = await broker.login();

        // Store session in the global broker instance
        setBrokerInstance(broker);

        // Save/update broker API key in DB (encrypted in production)
        await prisma.brokerApiKey.upsert({
            where: { userId_broker: { userId, broker: 'angelone' } },
            update: {
                apiKeyEncrypted: apiKey,
                apiSecretEncrypted: totpSecret,
                accessToken: tokens.jwtToken,
                refreshToken: tokens.refreshToken,
                feedToken: tokens.feedToken,
                tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
                isActive: true,
            },
            create: {
                userId,
                broker: 'angelone',
                apiKeyEncrypted: apiKey,
                apiSecretEncrypted: totpSecret,
                accessToken: tokens.jwtToken,
                refreshToken: tokens.refreshToken,
                feedToken: tokens.feedToken,
                tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        // Get user profile from Angel One
        let profile = null;
        try {
            profile = await broker.getProfile();
        } catch {
            // Non-fatal
        }

        logger.info('Broker login successful', { userId, broker: 'angelone' });

        res.json({
            success: true,
            data: {
                broker: 'angelone',
                clientId,
                connected: true,
                profile,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/broker/logout — Logout from Angel One
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const broker = getBrokerInstance();

        if (broker instanceof AngelOneBrokerService) {
            await broker.logout();
        }

        // Invalidate stored tokens
        await prisma.brokerApiKey.updateMany({
            where: { userId, broker: 'angelone' },
            data: {
                accessToken: null,
                refreshToken: null,
                feedToken: null,
                isActive: false,
            },
        });

        // Reset to paper broker
        setBrokerInstance(null);

        res.json({ success: true, message: 'Logged out from broker' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/broker/status — Check broker connection status
 */
router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const broker = getBrokerInstance();

        const storedKey = await prisma.brokerApiKey.findFirst({
            where: { userId, broker: 'angelone', isActive: true },
        });

        res.json({
            success: true,
            data: {
                broker: 'angelone',
                connected: broker?.isConnected() || false,
                tradingMode: env.TRADING_MODE,
                hasStoredCredentials: !!storedKey,
                tokenExpiry: storedKey?.tokenExpiresAt,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/broker/refresh — Refresh Angel One session token
 */
router.post('/refresh', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const broker = getBrokerInstance();

        if (!(broker instanceof AngelOneBrokerService)) {
            return res.status(400).json({ success: false, error: 'No active Angel One session' });
        }

        await broker.refreshSession();

        const tokens = broker.getTokens();
        if (tokens) {
            const userId = req.user!.userId;
            await prisma.brokerApiKey.updateMany({
                where: { userId, broker: 'angelone' },
                data: {
                    accessToken: tokens.jwtToken,
                    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            });
        }

        res.json({ success: true, message: 'Session refreshed' });
    } catch (error) {
        next(error);
    }
});

export default router;
