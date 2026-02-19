// ============================================================
// AUTH MIDDLEWARE — JWT verification + user injection
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';
import { AuthenticationError, AuthorizationError } from '../utils/errors';

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

// Extend Express Request with user info
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

// Default dev user — used when no JWT token is provided
const DEV_USER: JwtPayload = {
    userId: 'dev-user-001',
    email: 'dev@algotrading.local',
    role: 'ADMIN',
};

/**
 * Auth middleware — verifies JWT if present, otherwise assigns a default dev user.
 * This removes the login requirement so all pages work without authentication.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
            req.user = decoded;
        } else {
            // No token — use default dev user
            req.user = DEV_USER;
        }
        next();
    } catch {
        // Invalid/expired token — fall back to dev user
        req.user = DEV_USER;
        next();
    }
}

/**
 * Require specific role(s)
 */
export function authorize(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AuthenticationError());
        }
        if (!roles.includes(req.user.role)) {
            return next(new AuthorizationError());
        }
        next();
    };
}

/**
 * Optional auth — attaches user if token present, continues if not
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        }
    } catch {
        // Ignore invalid tokens for optional auth
    }
    next();
}
