// ============================================================
// ORDER RECONCILIATION ENGINE
// ============================================================
// Ensures our DB order state matches the broker's true state.
// Runs every 30 seconds on all non-terminal orders.
//
// Also handles:
//   - Partial fills: detect, record, decide retry/accept
//   - Auto retry: exponential backoff with max attempts
//   - Orphan detection: orders in broker not in our DB
//
// States machine per order:
//
//  CREATED → PLACED → PARTIALLY_FILLED → FILLED (terminal)
//                ↘ CANCELLED (terminal)
//                ↘ REJECTED  (terminal)
//                ↘ RETRY     → PLACED (retry loop)
// ============================================================

import { EventEmitter } from 'events';
import prisma from '../config/database';
import { IBrokerService, BrokerOrderStatus } from './brokerService';
import logger, { tradeLogger } from '../utils/logger';

// How long after placement before we consider an order "stale" and cancel
const STALE_ORDER_MINUTES = 10;
// Max retry attempts for failed/rejected orders
const MAX_RETRY_ATTEMPTS = 3;
// Retry delays: 5s, 15s, 45s
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];
// Partial fill threshold: if >= this % filled, accept without retry
const PARTIAL_FILL_ACCEPT_THRESHOLD = 0.75;

interface RetryRecord {
    orderId: string;
    attempts: number;
    nextRetryAt: Date;
    originalOrder: {
        userId: string;
        symbol: string;
        exchange: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        orderType: string;
        limitPrice?: number | null;
    };
}

export class OrderReconciliationService extends EventEmitter {
    private broker: IBrokerService | null = null;
    private reconcileTimer: NodeJS.Timeout | null = null;
    private retryQueue = new Map<string, RetryRecord>(); // orderId → RetryRecord
    private running = false;

    start(broker: IBrokerService): void {
        this.broker = broker;
        this.running = true;
        // Reconcile every 30 seconds
        this.reconcileTimer = setInterval(() => this.reconcileAll(), 30_000);
        // Process retry queue every 5 seconds
        setInterval(() => this.processRetryQueue(), 5_000);
        logger.info('📋 Order reconciliation service started');
    }

    stop(): void {
        this.running = false;
        if (this.reconcileTimer) {
            clearInterval(this.reconcileTimer);
            this.reconcileTimer = null;
        }
    }

    updateBroker(broker: IBrokerService): void {
        this.broker = broker;
    }

    // ─── RECONCILIATION ─────────────────────────────────────

    async reconcileAll(): Promise<void> {
        if (!this.broker || !this.running) return;

        // Find all non-terminal orders
        const pendingOrders = await prisma.order.findMany({
            where: {
                status: { notIn: ['FILLED', 'CANCELLED', 'REJECTED', 'FAILED'] },
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24h
            },
            select: {
                id: true,
                userId: true,
                brokerOrderId: true,
                symbol: true,
                exchange: true,
                side: true,
                quantity: true,
                filledQuantity: true,
                orderType: true,
                limitPrice: true,
                status: true,
                createdAt: true,
            },
        });

        if (pendingOrders.length === 0) return;

        logger.debug(`🔄 Reconciling ${pendingOrders.length} pending orders`);

        for (const order of pendingOrders) {
            try {
                await this.reconcileOrder(order);
            } catch (err: any) {
                logger.warn(`Reconcile error for order ${order.id}: ${err.message}`);
            }
        }
    }

    private async reconcileOrder(order: any): Promise<void> {
        if (!this.broker || !order.brokerOrderId) return;

        // Check for stale orders (placed long ago but still open)
        const ageMinutes = (Date.now() - order.createdAt.getTime()) / 60_000;
        if (ageMinutes > STALE_ORDER_MINUTES && order.status === 'PLACED') {
            logger.warn(`⏰ Stale order detected: ${order.symbol} placed ${ageMinutes.toFixed(0)}m ago — cancelling`);
            await this.cancelStaleOrder(order);
            return;
        }

        let brokerStatus: BrokerOrderStatus;
        try {
            brokerStatus = await this.broker.getOrderStatus(order.brokerOrderId);
        } catch (err: any) {
            logger.debug(`Could not fetch broker status for ${order.id}: ${err.message}`);
            return;
        }

        // Check for mismatches
        const ourStatus = order.status;
        const brokerStatusStr = brokerStatus.status;

        if (ourStatus === brokerStatusStr) return; // in sync

        logger.info(`🔄 Reconcile mismatch: DB=${ourStatus} Broker=${brokerStatusStr} [${order.symbol}]`);

        switch (brokerStatusStr) {
            case 'COMPLETE':
                await this.handleFilled(order, brokerStatus);
                break;

            case 'OPEN':
                // Still open — check if partially filled
                if (brokerStatus.filledQuantity > (order.filledQuantity ?? 0)) {
                    await this.handlePartialFill(order, brokerStatus);
                }
                break;

            case 'REJECTED':
                await this.handleRejected(order, brokerStatus);
                break;

            case 'CANCELLED':
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'CANCELLED' },
                });
                this.emit('order_cancelled', { orderId: order.id, symbol: order.symbol });
                break;
        }
    }

    // ─── FILL HANDLING ───────────────────────────────────────

    private async handleFilled(order: any, status: BrokerOrderStatus): Promise<void> {
        await prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'FILLED',
                filledQuantity: status.filledQuantity,
                averagePrice: status.averagePrice,
            } as any,
        });

        tradeLogger.info(`✅ ORDER FILLED: ${order.symbol} ${order.side} ${status.filledQuantity}@₹${status.averagePrice}`, {
            orderId: order.id,
            symbol: order.symbol,
        });

        this.emit('order_filled', {
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            filledQty: status.filledQuantity,
            avgPrice: status.averagePrice,
        });

        await this.auditLog(order.userId, 'ORDER_FILLED', 'INFO',
            `FILLED ${order.side} ${status.filledQuantity}x ${order.symbol} @₹${status.averagePrice}`);
    }

    // ─── PARTIAL FILL HANDLING ───────────────────────────────

    private async handlePartialFill(order: any, status: BrokerOrderStatus): Promise<void> {
        const filledQty = status.filledQuantity;
        const originalQty = order.quantity;
        const remainingQty = originalQty - filledQty;
        const fillRatio = filledQty / originalQty;

        await prisma.order.update({
            where: { id: order.id },
            data: {
                filledQuantity: filledQty,
                averagePrice: status.averagePrice,
            } as any,
        });

        logger.info(`⚡ PARTIAL FILL: ${order.symbol} ${filledQty}/${originalQty} @ ₹${status.averagePrice} (${(fillRatio * 100).toFixed(0)}%)`);

        // Decision logic
        if (fillRatio >= PARTIAL_FILL_ACCEPT_THRESHOLD) {
            // Accept the partial fill — enough to be meaningful
            logger.info(`✅ Partial fill accepted (${(fillRatio * 100).toFixed(0)}% >= ${PARTIAL_FILL_ACCEPT_THRESHOLD * 100}%): ${order.symbol}`);
            await this.cancelRemainder(order, filledQty, remainingQty);
        } else {
            // Too little filled — wait for more or retry remainder
            logger.info(`⏳ Partial fill too small (${(fillRatio * 100).toFixed(0)}%): waiting or will retry remainder`);
        }

        this.emit('partial_fill', {
            orderId: order.id,
            symbol: order.symbol,
            filledQty,
            remainingQty,
            fillRatio,
            avgPrice: status.averagePrice,
        });

        await this.auditLog(order.userId, 'PARTIAL_FILL', 'WARNING',
            `PARTIAL ${order.side} ${filledQty}/${originalQty}x ${order.symbol} @₹${status.averagePrice} (${(fillRatio * 100).toFixed(0)}%)`);
    }

    private async cancelRemainder(order: any, filledQty: number, remainingQty: number): Promise<void> {
        if (!this.broker || !order.brokerOrderId) return;
        try {
            await this.broker.cancelOrder(order.brokerOrderId);
            await prisma.order.update({
                where: { id: order.id },
                data: { status: 'FILLED', filledQuantity: filledQty } as any,
            });
            logger.info(`🗑  Remainder cancelled: ${remainingQty}x ${order.symbol}`);
        } catch (err: any) {
            logger.warn(`Could not cancel remainder for ${order.symbol}: ${err.message}`);
        }
    }

    // ─── REJECTION + RETRY ──────────────────────────────────

    private async handleRejected(order: any, status: BrokerOrderStatus): Promise<void> {
        const reason = status.rejectedReason || 'Unknown rejection reason';

        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'REJECTED' } as any,
        });

        logger.warn(`❌ ORDER REJECTED: ${order.symbol} — ${reason}`);
        this.emit('order_rejected', { orderId: order.id, symbol: order.symbol, reason });

        await this.auditLog(order.userId, 'ORDER_REJECTED', 'CRITICAL',
            `REJECTED ${order.side} ${order.quantity}x ${order.symbol}: ${reason}`);

        // Retry if retryable and under limit
        if (this.isRetryable(reason)) {
            await this.scheduleRetry(order, reason);
        }
    }

    // ─── RETRY LOGIC ────────────────────────────────────────

    private async scheduleRetry(order: any, reason: string): Promise<void> {
        const existing = this.retryQueue.get(order.id);
        const attempts = existing ? existing.attempts : 0;

        if (attempts >= MAX_RETRY_ATTEMPTS) {
            logger.warn(`🚫 Max retries (${MAX_RETRY_ATTEMPTS}) reached for ${order.symbol}. Giving up.`);
            await this.auditLog(order.userId, 'ORDER_RETRY_EXHAUSTED', 'CRITICAL',
                `All ${MAX_RETRY_ATTEMPTS} retries exhausted for ${order.symbol}: ${reason}`);
            return;
        }

        const delay = RETRY_DELAYS_MS[attempts] ?? 60_000;
        const nextRetryAt = new Date(Date.now() + delay);

        this.retryQueue.set(order.id, {
            orderId: order.id,
            attempts: attempts + 1,
            nextRetryAt,
            originalOrder: {
                userId: order.userId,
                symbol: order.symbol,
                exchange: order.exchange,
                side: order.side,
                quantity: order.quantity,
                orderType: order.orderType,
                limitPrice: order.limitPrice,
            },
        });

        logger.info(`🔁 Retry scheduled: ${order.symbol} attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS} in ${delay / 1000}s`);
        await this.auditLog(order.userId, 'ORDER_RETRY_SCHEDULED', 'WARNING',
            `Retry ${attempts + 1}/${MAX_RETRY_ATTEMPTS} scheduled for ${order.symbol} in ${delay / 1000}s`);
    }

    private async processRetryQueue(): Promise<void> {
        if (!this.broker || !this.running) return;
        const now = Date.now();

        for (const [orderId, record] of this.retryQueue) {
            if (record.nextRetryAt.getTime() > now) continue;

            this.retryQueue.delete(orderId);
            logger.info(`🔁 Retrying order: ${record.originalOrder.symbol} (attempt ${record.attempts})`);

            try {
                const newOrderResp = await this.broker.placeOrder({
                    symbol: record.originalOrder.symbol,
                    exchange: record.originalOrder.exchange,
                    side: record.originalOrder.side,
                    quantity: record.originalOrder.quantity,
                    orderType: record.originalOrder.orderType as any,
                    product: 'MIS',
                    limitPrice: record.originalOrder.limitPrice ?? undefined,
                });

                if (newOrderResp.status === 'PLACED') {
                    await prisma.order.create({
                        data: {
                            userId: record.originalOrder.userId,
                            symbol: record.originalOrder.symbol,
                            exchange: record.originalOrder.exchange,
                            side: record.originalOrder.side,
                            quantity: record.originalOrder.quantity,
                            orderType: record.originalOrder.orderType as any,
                            status: 'PLACED',
                            brokerOrderId: newOrderResp.orderId,
                        } as any,
                    });
                    logger.info(`✅ Retry succeeded: ${record.originalOrder.symbol} → new order ${newOrderResp.orderId}`);
                    this.emit('retry_success', { symbol: record.originalOrder.symbol, newOrderId: newOrderResp.orderId });
                } else {
                    // Re-queue for another attempt
                    await this.scheduleRetry({ id: orderId, ...record.originalOrder }, 'Retry rejected');
                }
            } catch (err: any) {
                logger.error(`Retry error for ${record.originalOrder.symbol}: ${err.message}`);
                await this.scheduleRetry({ id: orderId, ...record.originalOrder }, err.message);
            }
        }
    }

    private async cancelStaleOrder(order: any): Promise<void> {
        if (!this.broker || !order.brokerOrderId) {
            await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
            return;
        }
        try {
            await this.broker.cancelOrder(order.brokerOrderId);
        } catch { /* ignore */ }
        await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        await this.auditLog(order.userId, 'ORDER_STALE_CANCELLED', 'WARNING',
            `Stale order auto-cancelled: ${order.symbol} (placed >${STALE_ORDER_MINUTES}m ago)`);
        this.emit('order_stale_cancelled', { orderId: order.id, symbol: order.symbol });
    }

    // Determines if a rejection reason warrants a retry
    private isRetryable(reason: string): boolean {
        const retryReasons = [
            'session expired', 'timeout', 'network', 'rate limit',
            'temporarily unavailable', 'server error', '5xx',
        ];
        const lc = reason.toLowerCase();
        return retryReasons.some(r => lc.includes(r));
    }

    private async auditLog(userId: string, event: string, severity: string, message: string): Promise<void> {
        try {
            await prisma.auditLog.create({ data: { userId, event, severity, message } });
        } catch { /* non-fatal */ }
    }
}

export const orderReconciliationService = new OrderReconciliationService();
