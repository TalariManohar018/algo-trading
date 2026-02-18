// ============================================================
// CUSTOM ERROR CLASSES — Typed errors for clean error handling
// ============================================================

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

export class ValidationError extends AppError {
    public errors: Record<string, string[]>;

    constructor(errors: string | Record<string, string[]>) {
        const message = typeof errors === 'string' ? errors : 'Validation failed';
        super(message, 400);
        this.errors = typeof errors === 'string' ? { general: [errors] } : errors;
    }
}

export class TradingError extends AppError {
    constructor(message: string) {
        super(message, 422);
    }
}

export class RiskBreachError extends AppError {
    constructor(message: string) {
        super(`RISK BREACH: ${message}`, 422);
    }
}

export class BrokerError extends AppError {
    constructor(message: string) {
        super(`Broker error: ${message}`, 502);
    }
}
