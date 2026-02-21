// ============================================================
// EXECUTION QUEUE — Serialised, concurrency-safe order pipeline
// ============================================================
// Problem: multiple strategies can fire simultaneously on the
// same symbol/user. Without serialisation this produces:
//   - Duplicate orders on same candle
//   - Race condition on position checks
//   - Exceeded broker rate limits
//
// Solution: per-user FIFO queue processed one-at-a-time.
// Each item is a full order request. The queue worker:
//   1. De-duplicates by (symbol + side + strategyId + minuteKey)
//   2. Enforces 300ms min gap between broker API calls
//   3. Records queue metrics for monitoring
//
// Architecture:
//   Strategy signals → enqueue() → worker loop → OrderExecutor
// ============================================================

import { EventEmitter } from 'events';
import logger from '../utils/logger';
import prisma from '../config/database';

export interface QueuedOrder {
    id: string;          // client-assigned idempotency key
    userId: string;
    strategyId?: string;
    symbol: string;
    exchange: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    limitPrice?: number;
    triggerPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    priority: number;    // higher = processed first
    enqueuedAt: Date;
}

export type OrderHandler = (order: QueuedOrder) => Promise<void>;

interface QueueMetrics {
    totalEnqueued: number;
    totalProcessed: number;
    totalDroppedDuplicates: number;
    totalErrors: number;
    queueDepth: number;
    avgProcessingMs: number;
    lastProcessedAt: Date | null;
}

export class ExecutionQueue extends EventEmitter {
    // Per-user queues to allow parallel processing across different users
    private queues = new Map<string, QueuedOrder[]>();
    private processing = new Map<string, boolean>();
    // Dedup set: `userId:symbol:side:minuteKey:strategyId`
    private dedupSet = new Set<string>();
    private handler: OrderHandler | null = null;
    private metrics: QueueMetrics = {
        totalEnqueued: 0,
        totalProcessed: 0,
        totalDroppedDuplicates: 0,
        totalErrors: 0,
        queueDepth: 0,
        avgProcessingMs: 0,
        lastProcessedAt: null,
    };
    // Minimum ms between consecutive broker API calls (rate-limit protection)
    private readonly MIN_ORDER_GAP_MS = 300;
    private lastOrderTime = new Map<string, number>(); // per-user
    // Max orders queued per user before oldest is dropped (circuit breaker)
    private readonly MAX_QUEUE_DEPTH = 10;

    /**
     * Register the function that actually places the order.
     * Called once at startup.
     */
    setHandler(fn: OrderHandler): void {
        this.handler = fn;
    }

    /**
     * Enqueue an order request.
     * Returns true if accepted, false if deduplicated or queue full.
     */
    enqueue(order: QueuedOrder): boolean {
        const dedupKey = this.buildDedupKey(order);

        // 1. Deduplication check
        if (this.dedupSet.has(dedupKey)) {
            this.metrics.totalDroppedDuplicates++;
            logger.debug(`⏭ Queue dedup drop: ${order.symbol} ${order.side} [${order.id}]`);
            this.emit('dedup_drop', { order, reason: 'duplicate_in_queue' });
            return false;
        }

        // 2. Queue depth guard (per user)
        const userQueue = this.getOrCreateQueue(order.userId);
        if (userQueue.length >= this.MAX_QUEUE_DEPTH) {
            // Drop lowest priority order to make room
            const lowestIdx = this.findLowestPriorityIndex(userQueue);
            const dropped = userQueue.splice(lowestIdx, 1)[0];
            this.dedupSet.delete(this.buildDedupKey(dropped));
            logger.warn(`⚠️  Queue full (${this.MAX_QUEUE_DEPTH}): dropped lowest priority order ${dropped.symbol}`);
            this.emit('queue_drop', { dropped, reason: 'queue_full' });
            this.persistAuditLog(order.userId, 'ORDER_DROPPED', 'WARNING',
                `Queue full: dropped ${dropped.symbol} ${dropped.side}`);
        }

        // 3. Insert in priority order (higher first)
        this.dedupSet.add(dedupKey);
        this.insertByPriority(userQueue, order);
        this.metrics.totalEnqueued++;
        this.updateQueueDepth();

        logger.debug(`📥 Queued: ${order.symbol} ${order.side} qty=${order.quantity} [${order.id}] depth=${userQueue.length}`);
        this.emit('queued', { order, queueDepth: userQueue.length });

        // Start processing if not already running
        this.processQueue(order.userId);

        return true;
    }

    getMetrics(): QueueMetrics {
        return { ...this.metrics };
    }

    /**
     * Drain a user's queue (used on emergency stop).
     */
    drainUser(userId: string): number {
        const q = this.queues.get(userId);
        if (!q || q.length === 0) return 0;
        const count = q.length;
        for (const order of q) this.dedupSet.delete(this.buildDedupKey(order));
        q.length = 0;
        this.updateQueueDepth();
        logger.warn(`🚫 Queue drained for user ${userId} (${count} orders dropped)`);
        return count;
    }

    /**
     * Clear dedup set at the start of each new candle/minute.
     * This allows a strategy to re-enter on the next candle.
     */
    clearDedupForNewCandle(): void {
        this.dedupSet.clear();
    }

    // ─── PRIVATE ─────────────────────────────────────────────

    private async processQueue(userId: string): Promise<void> {
        if (this.processing.get(userId)) return;
        this.processing.set(userId, true);

        try {
            const queue = this.queues.get(userId) || [];

            while (queue.length > 0) {
                const order = queue.shift()!;
                this.dedupSet.delete(this.buildDedupKey(order));
                this.updateQueueDepth();

                if (!this.handler) {
                    logger.error('ExecutionQueue: no handler registered');
                    break;
                }

                // Rate-limit: enforce minimum gap between broker calls
                const lastTime = this.lastOrderTime.get(userId) || 0;
                const elapsed = Date.now() - lastTime;
                if (elapsed < this.MIN_ORDER_GAP_MS) {
                    await sleep(this.MIN_ORDER_GAP_MS - elapsed);
                }

                const start = Date.now();
                try {
                    await this.handler(order);
                    const elapsed = Date.now() - start;
                    this.lastOrderTime.set(userId, Date.now());
                    this.metrics.totalProcessed++;
                    this.metrics.lastProcessedAt = new Date();
                    // Exponential moving average of processing time
                    this.metrics.avgProcessingMs =
                        this.metrics.avgProcessingMs * 0.9 + elapsed * 0.1;

                    logger.debug(`✅ Queue processed: ${order.symbol} ${order.side} in ${elapsed}ms`);
                    this.emit('processed', { order, durationMs: elapsed });
                } catch (err: any) {
                    this.metrics.totalErrors++;
                    logger.error(`❌ Queue handler error [${order.symbol}]: ${err.message}`);
                    this.emit('handler_error', { order, error: err.message });
                    await this.persistAuditLog(userId, 'QUEUE_ERROR', 'CRITICAL',
                        `Order execution error: ${order.symbol} ${order.side} — ${err.message}`);
                }
            }
        } finally {
            this.processing.set(userId, false);
        }
    }

    private getOrCreateQueue(userId: string): QueuedOrder[] {
        if (!this.queues.has(userId)) this.queues.set(userId, []);
        return this.queues.get(userId)!;
    }

    private buildDedupKey(order: QueuedOrder): string {
        // Dedup window = 1 minute per symbol+side+strategy
        const minuteKey = Math.floor(order.enqueuedAt.getTime() / 60_000);
        return `${order.userId}:${order.symbol}:${order.side}:${order.strategyId ?? 'manual'}:${minuteKey}`;
    }

    private insertByPriority(queue: QueuedOrder[], order: QueuedOrder): void {
        const idx = queue.findIndex(q => q.priority < order.priority);
        if (idx === -1) queue.push(order);
        else queue.splice(idx, 0, order);
    }

    private findLowestPriorityIndex(queue: QueuedOrder[]): number {
        let minIdx = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].priority < queue[minIdx].priority) minIdx = i;
        }
        return minIdx;
    }

    private updateQueueDepth(): void {
        let total = 0;
        for (const q of this.queues.values()) total += q.length;
        this.metrics.queueDepth = total;
    }

    private async persistAuditLog(
        userId: string,
        event: string,
        severity: string,
        message: string
    ): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: { userId, event, severity, message },
            });
        } catch { /* non-fatal */ }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const executionQueue = new ExecutionQueue();
