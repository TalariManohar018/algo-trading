// ============================================================
// WINSTON LOGGER — Structured logging with file rotation
// ============================================================
import winston from 'winston';
import { env } from '../config/env';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
    })
);

export const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: logFormat,
    defaultMeta: { service: 'algo-trading' },
    transports: [
        // Console — always
        new winston.transports.Console({ format: consoleFormat }),

        // File — errors only
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),

        // File — all logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
        }),

        // File — trades only (critical for audit)
        new winston.transports.File({
            filename: path.join(logDir, 'trades.log'),
            level: 'info',
            maxsize: 50 * 1024 * 1024,
            maxFiles: 20,
        }),
    ],
});

// Trading-specific logger for order/position events
export const tradeLogger = logger.child({ context: 'trading' });

// Risk-specific logger
export const riskLogger = logger.child({ context: 'risk' });

export default logger;
