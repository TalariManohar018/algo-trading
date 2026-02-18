// ============================================================
// ENVIRONMENT CONFIG — Single source of truth for all env vars
// ============================================================
import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
}

function optional(key: string, fallback: string): string {
    return process.env[key] || fallback;
}

export const env = {
    NODE_ENV: optional('NODE_ENV', 'development'),
    PORT: parseInt(optional('PORT', '3001')),
    isDev: optional('NODE_ENV', 'development') === 'development',
    isProd: process.env.NODE_ENV === 'production',

    // Database
    DATABASE_URL: required('DATABASE_URL'),

    // JWT
    JWT_SECRET: required('JWT_SECRET'),
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '24h'),
    JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

    // Encryption
    ENCRYPTION_KEY: required('ENCRYPTION_KEY'),

    // Zerodha
    KITE_API_KEY: optional('KITE_API_KEY', ''),
    KITE_API_SECRET: optional('KITE_API_SECRET', ''),
    KITE_ACCESS_TOKEN: optional('KITE_ACCESS_TOKEN', ''),

    // Trading
    TRADING_MODE: optional('TRADING_MODE', 'paper') as 'paper' | 'live',
    MAX_DAILY_LOSS: parseFloat(optional('MAX_DAILY_LOSS', '5000')),
    MAX_TRADE_SIZE: parseFloat(optional('MAX_TRADE_SIZE', '50000')),
    MAX_OPEN_POSITIONS: parseInt(optional('MAX_OPEN_POSITIONS', '5')),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000')),
    RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100')),

    // Logging
    LOG_LEVEL: optional('LOG_LEVEL', 'info'),

    // CORS
    CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
    FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
} as const;
