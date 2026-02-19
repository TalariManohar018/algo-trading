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
import { tradingWS } from './websocket/wsServer';
import http from 'http';

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

    // 4. Start market data service
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
