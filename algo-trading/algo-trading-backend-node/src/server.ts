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

    // 2. Create HTTP server
    const server = http.createServer(app);

    // 3. Start market data service
    try {
        marketDataService.start(['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK']);
        logger.info(`Market data service started (mode: ${env.TRADING_MODE})`);
    } catch (err) {
        logger.warn('Market data service failed to start (non-fatal)', err);
    }

    // 4. Start listening
    server.listen(PORT, () => {
        logger.info(`
╔══════════════════════════════════════════════╗
║      Algo Trading Backend v1.0.0             ║
║      Port: ${String(PORT).padEnd(33)}║
║      Mode: ${env.TRADING_MODE.padEnd(33)}║
║      Node: ${process.version.padEnd(33)}║
╚══════════════════════════════════════════════╝`);
    });

    // 5. Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — shutting down gracefully`);

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
