// ============================================================
// SERVER ENTRY POINT
// ============================================================
// Starts Express + WebSocket server, connects to database,
// initializes market data feeds.
// ============================================================

import app from './app';
import { env } from './config/env';
import prisma from './config/database';
import { logger } from './utils/logger';
import { marketDataService } from './services/marketDataService';
import { executionEngine } from './engine/executionEngine';
import { autoConnectBroker } from './engine/brokerFactory';
import { tradingWS } from './websocket/wsServer';
import http from 'http';
import cron from 'node-cron';

const PORT = env.PORT;

async function main() {
    // 1. Test database connection
    try {
        await prisma.$connect();
        logger.info('Database connected');
    } catch (err) {
        logger.error('Failed to connect to database', err);
        process.exit(1);
    }

    // 2. Seed default dev user (auth bypass)
    try {
        await prisma.user.upsert({
            where: { id: 'dev-user-001' },
            update: {},
            create: {
                id: 'dev-user-001',
                email: 'dev@algotrading.local',
                passwordHash: 'dev-no-password',
                fullName: 'Dev User',
                role: 'ADMIN',
                wallet: { create: { balance: 100000, availableMargin: 100000 } },
                riskState: { create: {} },
            },
        });
        logger.info('Dev user seeded');
    } catch (err) {
        logger.warn('Dev user seed skipped (may already exist)', err);
    }

    // 3. Create HTTP server
    const server = http.createServer(app);

    // 3. Attach WebSocket server
    tradingWS.attach(server);
    logger.info('WebSocket server attached');

    // 4. Auto-connect broker if TRADING_MODE=live
    try {
        await autoConnectBroker();
    } catch (err) {
        logger.warn('Broker auto-connect failed (non-fatal)', err);
    }

    // 5. Start market data service
    try {
        marketDataService.start(['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK']);
        logger.info(`Market data service started (mode: ${env.TRADING_MODE})`);
    } catch (err) {
        logger.warn('Market data service failed to start (non-fatal)', err);
    }

    // 5. Start execution engine (auto-loads RUNNING strategies)
    try {
        await executionEngine.start();
        logger.info('Execution engine started');
    } catch (err) {
        logger.warn('Execution engine failed to start (non-fatal)', err);
    }

    // 6. Start listening
    server.listen(PORT, () => {
        logger.info(`
╔══════════════════════════════════════════════════╗
║      Algo Trading Backend v1.0.0                 ║
║      Port: ${String(PORT).padEnd(37)}║
║      Mode: ${env.TRADING_MODE.padEnd(37)}║
║      Node: ${process.version.padEnd(37)}║
║      WS:   ws://localhost:${String(PORT).padEnd(24)}║
╚══════════════════════════════════════════════════╝`);
    });

    // 7. Auto square-off scheduler (live trading safety — IST timezone)
    if (env.TRADING_MODE === 'live') {
        // 3:20 PM IST — square off ALL open positions (MIS must close before 3:30)
        cron.schedule('20 15 * * 1-5', async () => {
            logger.warn('⏰ AUTO SQUARE-OFF triggered (3:20 PM IST) — closing all open positions');
            try {
                const result = await executionEngine.emergencyStop();
                logger.warn('Auto square-off complete', result);
            } catch (err: any) {
                logger.error('Auto square-off failed', { error: err.message });
            }
        }, { timezone: 'Asia/Kolkata' });

        // 3:30 PM IST — stop execution engine at market close
        cron.schedule('30 15 * * 1-5', async () => {
            logger.info('🔔 Market close (3:30 PM IST) — stopping execution engine');
            try {
                await executionEngine.stop();
            } catch (err: any) {
                logger.error('Engine stop at market close failed', { error: err.message });
            }
        }, { timezone: 'Asia/Kolkata' });

        // 9:00 AM IST — pre-market: re-start execution engine on trading days
        cron.schedule('0 9 * * 1-5', async () => {
            logger.info('🌅 Pre-market (9:00 AM IST) — starting execution engine');
            try {
                await executionEngine.start();
            } catch (err: any) {
                logger.error('Engine pre-market start failed', { error: err.message });
            }
        }, { timezone: 'Asia/Kolkata' });

        logger.info('📅 Live trading scheduler active: auto-squareoff 3:20 PM, engine-stop 3:30 PM, engine-start 9:00 AM (Mon-Fri IST)');
    }

    // 7. Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — shutting down gracefully`);

        await executionEngine.stop();
        logger.info('Execution engine stopped');

        marketDataService.stop();
        logger.info('Market data service stopped');

        server.close(() => {
            logger.info('HTTP server closed');
        });

        await prisma.$disconnect();
        logger.info('Database disconnected');

        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Catch unhandled errors
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
        logger.error('Uncaught Exception:', err);
        process.exit(1);
    });
}

main();
