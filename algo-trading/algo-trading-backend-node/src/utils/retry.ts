// ============================================================
// RETRY UTILITY — Exponential backoff with jitter
// ============================================================
// Used for broker API calls that may fail due to network issues,
// rate limits, or temporary server errors.
// ============================================================

import logger from './logger';

export interface RetryOptions {
    /** Maximum number of attempts (including the first). Default: 3 */
    maxAttempts?: number;
    /** Initial delay in ms before first retry. Default: 1000 */
    initialDelayMs?: number;
    /** Maximum delay cap in ms. Default: 30000 */
    maxDelayMs?: number;
    /** Backoff multiplier. Default: 2 */
    backoffFactor?: number;
    /** Add random jitter (0–30% of delay). Default: true */
    jitter?: boolean;
    /** Label for log messages. Default: 'operation' */
    label?: string;
    /** Predicate — return true if this error is retryable. Default: all errors */
    isRetryable?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30_000,
    backoffFactor: 2,
    jitter: true,
    label: 'operation',
    isRetryable: () => true,
};

/**
 * Execute an async function with exponential backoff retry.
 *
 * @example
 * const result = await withRetry(
 *   () => broker.placeOrder(order),
 *   { maxAttempts: 3, label: 'placeOrder' }
 * );
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions,
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if error is retryable
            if (!opts.isRetryable(error)) {
                logger.warn(`[Retry] ${opts.label} failed (non-retryable): ${error.message}`);
                throw error;
            }

            if (attempt === opts.maxAttempts) {
                logger.error(`[Retry] ${opts.label} failed after ${opts.maxAttempts} attempts: ${error.message}`);
                throw error;
            }

            // Calculate delay with exponential backoff + optional jitter
            let delay = opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1);
            if (opts.jitter) {
                delay += Math.random() * delay * 0.3;
            }
            delay = Math.min(delay, opts.maxDelayMs);

            logger.warn(
                `[Retry] ${opts.label} attempt ${attempt}/${opts.maxAttempts} failed: ${error.message}. ` +
                `Retrying in ${Math.round(delay)}ms...`
            );

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Simple rate limiter — ensures minimum delay between calls.
 */
export class RateLimiter {
    private lastCall = 0;

    constructor(private minIntervalMs: number) { }

    async throttle(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastCall;
        if (elapsed < this.minIntervalMs) {
            await sleep(this.minIntervalMs - elapsed);
        }
        this.lastCall = Date.now();
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
