// ============================================================
// ERROR HANDLER — Global Express error middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Log the error
    const logContext = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.userId,
    };

    if (err instanceof AppError && err.isOperational) {
        logger.warn(`Operational error: ${err.message}`, { ...logContext, statusCode: err.statusCode });
    } else {
        logger.error(`Unhandled error: ${err.message}`, { ...logContext, stack: err.stack });
    }

    // Determine status code
    const statusCode = err instanceof AppError ? err.statusCode : 500;

    // Build response
    const response: Record<string, unknown> = {
        success: false,
        error: err instanceof AppError ? err.message : 'Internal server error',
    };

    // Include validation details
    if (err instanceof ValidationError) {
        response.errors = err.errors;
    }

    // Include stack trace in development
    if (env.isDev && !(err instanceof AppError)) {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Catch async errors in route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
