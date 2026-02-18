// ============================================================
// RATE LIMITER — Protect API from abuse
// ============================================================
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API rate limit
export const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
});

// Stricter limit for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Order placement rate limit (Zerodha allows ~3/second)
export const orderLimiter = rateLimit({
    windowMs: 1000,
    max: 2, // 2 per second to stay safe
    message: { success: false, error: 'Order rate limit exceeded.' },
});
