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

    // Zerodha (legacy)
    KITE_API_KEY: optional('KITE_API_KEY', ''),
    KITE_API_SECRET: optional('KITE_API_SECRET', ''),
    KITE_ACCESS_TOKEN: optional('KITE_ACCESS_TOKEN', ''),

    // Angel One SmartAPI
    ANGEL_API_KEY: optional('ANGEL_API_KEY', ''),
    ANGEL_CLIENT_ID: optional('ANGEL_CLIENT_ID', ''),
    ANGEL_MPIN: optional('ANGEL_MPIN', ''),
    ANGEL_PASSWORD: optional('ANGEL_PASSWORD', '') || optional('ANGEL_MPIN', ''),  // password takes priority, falls back to MPIN
    ANGEL_TOTP_SECRET: optional('ANGEL_TOTP_SECRET', ''),

    // Trading
    TRADING_MODE: optional('TRADING_MODE', 'paper') as 'paper' | 'live',
    MAX_DAILY_LOSS: parseFloat(optional('MAX_DAILY_LOSS', '200')),
    MAX_TRADE_SIZE: parseFloat(optional('MAX_TRADE_SIZE', '5000')),
    MAX_OPEN_POSITIONS: parseInt(optional('MAX_OPEN_POSITIONS', '2')),
    MAX_RISK_PER_TRADE: parseFloat(optional('MAX_RISK_PER_TRADE', '100')),
    MAX_TRADES_PER_DAY: parseInt(optional('MAX_TRADES_PER_DAY', '5')),
    CONSECUTIVE_LOSS_LIMIT: parseInt(optional('CONSECUTIVE_LOSS_LIMIT', '3')),

    // ── LIVE_SAFE_MODE ──────────────────────────────────────
    // When true (default for live):
    //   • Qty capped to 1 per order
    //   • Auto re-entry disabled (1 trade per strategy per day)
    //   • Strategy auto-halted (status → ERROR) on any evaluation error
    LIVE_SAFE_MODE: optional('LIVE_SAFE_MODE', 'true') === 'true',

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000')),
    RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100')),

    // Logging
    LOG_LEVEL: optional('LOG_LEVEL', 'info'),

    // CORS
    CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
    FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
} as const;
