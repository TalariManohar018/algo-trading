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

/**
 * Require valid JWT token. Attaches user info to req.user
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new AuthenticationError('Token expired'));
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new AuthenticationError('Invalid token'));
        } else {
            next(error);
        }
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
