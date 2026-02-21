// ============================================================
// CIRCUIT BREAKER + BROKER FAILOVER
// ============================================================
// The circuit breaker prevents cascading failures when the
// broker API is degraded or down.
//
// States:
//   CLOSED   → normal operation. All requests pass through.
//   OPEN     → broker failed too many times. Requests blocked.
//              Allows single probe after `resetTimeout`.
//   HALF_OPEN → probe request allowed through. If success →
//               CLOSED. If fail → OPEN again.
//
// Failover strategy:
//   Primary broker (Angel One live) → fails →
//   Automatic fallback to Paper broker (safe mode) →
//   All orders simulated, no real capital at risk.
//   Alert emitted for manual review.
//
// Usage:
//   Wrap every broker call with circuitBreaker.call(fn)
// ============================================================

import { EventEmitter } from 'events';
import logger from '../utils/logger';
import prisma from '../config/database';
import { IBrokerService } from './brokerService';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
    failureThreshold: number;    // consecutive failures before OPEN
    resetTimeoutMs: number;      // ms before HALF_OPEN probe
    successThreshold: number;    // consecutive successes to re-CLOSE
    callTimeoutMs: number;       // abort if broker call takes longer
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,      // 60s before retry
    successThreshold: 2,
    callTimeoutMs: 8_000,        // 8s max per broker call
};

export class CircuitBreaker extends EventEmitter {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private successCount = 0;
    private lastFailureAt: Date | null = null;
    private openedAt: Date | null = null;
    private config: CircuitBreakerConfig;
    private userId = 'dev-user-001';

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get isOpen(): boolean {
        return this.state === 'OPEN';
    }

    get currentState(): CircuitState {
        return this.state;
    }

    /**
     * Wrap a broker call with circuit breaker protection.
     * Throws CircuitOpenError if the circuit is OPEN.
     */
    async call<T>(fn: () => Promise<T>, operationName = 'broker_call'): Promise<T> {
        if (this.state === 'OPEN') {
            // Check if reset timeout has passed — try HALF_OPEN
            const msElapsed = Date.now() - (this.openedAt?.getTime() ?? 0);
            if (msElapsed >= this.config.resetTimeoutMs) {
                this.transitionTo('HALF_OPEN');
                logger.info('⚡ Circuit HALF_OPEN — probing broker');
            } else {
                const remaining = Math.ceil((this.config.resetTimeoutMs - msElapsed) / 1000);
                throw new CircuitOpenError(`Circuit OPEN — broker unavailable. Retry in ${remaining}s`);
            }
        }

        try {
            const result = await this.withTimeout(fn, this.config.callTimeoutMs, operationName);
            this.onSuccess();
            return result;
        } catch (err: any) {
            if (err instanceof CircuitOpenError) throw err;
            this.onFailure(err, operationName);
            throw err;
        }
    }

    /**
     * Record a success (externally, e.g. from health check).
     */
    recordSuccess(): void {
        this.onSuccess();
    }

    /**
     * Record a failure (externally).
     */
    recordFailure(err: Error): void {
        this.onFailure(err, 'external');
    }

    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureAt: this.lastFailureAt,
            openedAt: this.openedAt,
        };
    }

    // ─── PRIVATE ─────────────────────────────────────────────

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.transitionTo('CLOSED');
                logger.info('✅ Circuit CLOSED — broker recovered');
            }
        }
    }

    private onFailure(err: Error, operationName: string): void {
        this.failureCount++;
        this.successCount = 0;
        this.lastFailureAt = new Date();

        logger.warn(`🔴 Circuit failure #${this.failureCount} [${operationName}]: ${err.message}`);

        if (this.state === 'HALF_OPEN') {
            this.transitionTo('OPEN');
            return;
        }

        if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
            this.transitionTo('OPEN');
        }
    }

    private transitionTo(newState: CircuitState): void {
        const prev = this.state;
        this.state = newState;

        if (newState === 'OPEN') {
            this.openedAt = new Date();
            this.successCount = 0;
            logger.error(`🔴 Circuit OPEN after ${this.failureCount} failures — all broker calls blocked`);
            this.emit('circuit_open', { failureCount: this.failureCount });
            this.persistAlert(`Circuit breaker OPEN after ${this.failureCount} consecutive broker failures`);
        } else if (newState === 'CLOSED') {
            this.failureCount = 0;
            this.openedAt = null;
            this.emit('circuit_closed', {});
            this.persistAlert('Circuit breaker CLOSED — broker connection restored', 'INFO');
        } else if (newState === 'HALF_OPEN') {
            this.emit('circuit_half_open', {});
        }

        logger.info(`Circuit: ${prev} → ${newState}`);
    }

    private withTimeout<T>(fn: () => Promise<T>, ms: number, name: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() =>
                reject(new Error(`${name} timed out after ${ms}ms`)), ms);
            fn().then(result => {
                clearTimeout(timer);
                resolve(result);
            }).catch(err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    private persistAlert(message: string, severity = 'CRITICAL'): void {
        prisma.auditLog.create({
            data: {
                userId: this.userId,
                event: 'CIRCUIT_BREAKER',
                severity,
                message,
            },
        }).catch(() => { });
    }
}

export class CircuitOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

// ─── BROKER FAILOVER WRAPPER ──────────────────────────────

/**
 * Wraps a primary broker with a circuit breaker.
 * On circuit OPEN, all calls are automatically routed to the
 * fallback (paper) broker. Alerts are emitted for monitoring.
 */
export class BrokerWithFailover implements IBrokerService {
    private useFallback = false;
    private breaker: CircuitBreaker;

    constructor(
        private primary: IBrokerService,
        private fallback: IBrokerService,
        breakerConfig?: Partial<CircuitBreakerConfig>
    ) {
        this.breaker = new CircuitBreaker(breakerConfig);

        this.breaker.on('circuit_open', () => {
            this.useFallback = true;
            logger.error('🚨 FAILOVER: switched to paper broker — NO REAL ORDERS will be placed');
            prisma.auditLog.create({
                data: {
                    userId: 'dev-user-001',
                    event: 'BROKER_FAILOVER',
                    severity: 'CRITICAL',
                    message: 'Primary broker circuit OPEN — switched to paper broker fallback. No real orders.',
                },
            }).catch(() => { });
        });

        this.breaker.on('circuit_closed', () => {
            this.useFallback = false;
            logger.info('✅ Primary broker recovered — failover deactivated');
        });
    }

    private get active(): IBrokerService {
        return this.useFallback ? this.fallback : this.primary;
    }

    async placeOrder(order: any) {
        if (this.useFallback) {
            logger.warn(`[FAILOVER] Placing order on paper broker: ${order.symbol}`);
            return this.fallback.placeOrder(order);
        }
        return this.breaker.call(() => this.primary.placeOrder(order), 'placeOrder');
    }

    async cancelOrder(orderId: string) {
        if (this.useFallback) return this.fallback.cancelOrder(orderId);
        return this.breaker.call(() => this.primary.cancelOrder(orderId), 'cancelOrder');
    }

    async getOrderStatus(orderId: string) {
        if (this.useFallback) return this.fallback.getOrderStatus(orderId);
        return this.breaker.call(() => this.primary.getOrderStatus(orderId), 'getOrderStatus');
    }

    async getCurrentPrice(symbol: string, exchange?: string) {
        // Price fetching: try primary, silently use fallback on failure
        try {
            return await this.breaker.call(() => this.primary.getCurrentPrice(symbol, exchange), 'getCurrentPrice');
        } catch {
            return this.fallback.getCurrentPrice(symbol, exchange);
        }
    }

    async getPositions() {
        if (this.useFallback) return this.fallback.getPositions();
        return this.breaker.call(() => this.primary.getPositions(), 'getPositions');
    }

    async squareOffAll() {
        return this.active.squareOffAll();
    }

    async cancelAllOrders() {
        return this.active.cancelAllOrders();
    }

    isConnected(): boolean {
        return this.useFallback ? this.fallback.isConnected() : this.primary.isConnected();
    }

    getCircuitStats() {
        return this.breaker.getStats();
    }

    isOnFallback(): boolean {
        return this.useFallback;
    }
}

export const brokerCircuitBreaker = new CircuitBreaker();
