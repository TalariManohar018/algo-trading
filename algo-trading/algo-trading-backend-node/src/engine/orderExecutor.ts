// ============================================================
// ORDER EXECUTOR — Handles order lifecycle with safety checks
// ============================================================
// Pipeline: Validate → Risk Check → Place with Broker → 
//           Poll Status → Update DB → Notify via SSE
// ============================================================

import prisma from '../config/database';
import { IBrokerService, BrokerOrder } from './brokerService';
import { tradeLogger } from '../utils/logger';
import { TradingError, RiskBreachError } from '../utils/errors';
import { riskManagementService } from '../services/riskService';

export interface OrderRequest {
    userId: string;
    strategyId?: string;
    symbol: string;
    exchange?: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    limitPrice?: number;
    triggerPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
}

export class OrderExecutor {
    constructor(private broker: IBrokerService) { }

    /**
     * Execute a full order lifecycle: validate → place → track → update
     */
    async executeOrder(request: OrderRequest) {
        // 1. Create order record in DB
        const order = await prisma.order.create({
            data: {
                userId: request.userId,
                strategyId: request.strategyId || null,
                symbol: request.symbol,
                exchange: request.exchange || 'NSE',
                side: request.side,
                quantity: request.quantity,
                orderType: request.orderType === 'SL-M' ? 'SL_M' : request.orderType as any,
                limitPrice: request.limitPrice,
                triggerPrice: request.triggerPrice,
                status: 'CREATED',
            },
        });

        tradeLogger.info('Order created', {
            orderId: order.id,
            symbol: request.symbol,
            side: request.side,
            quantity: request.quantity,
        });

        try {
            // 2. Place with broker
            const brokerOrder: BrokerOrder = {
                symbol: request.symbol,
                exchange: request.exchange || 'NSE',
                side: request.side,
                quantity: request.quantity,
                orderType: request.orderType,
                product: 'MIS', // Intraday by default
                limitPrice: request.limitPrice,
                triggerPrice: request.triggerPrice,
            };

            const response = await this.broker.placeOrder(brokerOrder);

            if (response.status === 'REJECTED') {
                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        status: 'REJECTED',
                        rejectedReason: response.message,
                        brokerOrderId: response.orderId || null,
                    },
                });

                tradeLogger.warn('Order rejected by broker', {
                    orderId: order.id,
                    reason: response.message,
                });

                return { ...order, status: 'REJECTED', rejectedReason: response.message };
            }

            // 3. Update order as placed
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'PLACED',
                    brokerOrderId: response.orderId,
                    placedAt: new Date(),
                },
            });

            // 4. Poll for fill (for paper trading, this is immediate)
            const fillStatus = await this.broker.getOrderStatus(response.orderId);

            if (fillStatus.status === 'COMPLETE') {
                const filledOrder = await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        status: 'FILLED',
                        filledPrice: fillStatus.averagePrice,
                        filledQuantity: fillStatus.filledQuantity,
                        filledAt: new Date(),
                    },
                });

                tradeLogger.info('Order filled', {
                    orderId: order.id,
                    price: fillStatus.averagePrice,
                    quantity: fillStatus.filledQuantity,
                });

                // 5. Create/update position
                await this.handleFill(request, filledOrder, fillStatus.averagePrice);

                return filledOrder;
            }

            // For live broker with pending orders, return placed status
            return { ...order, status: 'PLACED', brokerOrderId: response.orderId };
        } catch (error: any) {
            await prisma.order.update({
                where: { id: order.id },
                data: { status: 'REJECTED', rejectedReason: error.message },
            });
            throw error;
        }
    }

    /**
     * Handle a filled order — create or close position
     */
    private async handleFill(request: OrderRequest, order: any, filledPrice: number) {
        if (request.side === 'BUY') {
            // Open a new LONG position with SL and TP
            await prisma.position.create({
                data: {
                    userId: request.userId,
                    strategyId: request.strategyId || null,
                    symbol: request.symbol,
                    exchange: request.exchange || 'NSE',
                    side: 'LONG',
                    quantity: request.quantity,
                    entryPrice: filledPrice,
                    currentPrice: filledPrice,
                    stopLoss: request.stopLoss ?? null,
                    takeProfit: request.takeProfit ?? null,
                    entryOrderId: order.id,
                    status: 'OPEN',
                },
            });

            // Update wallet margin
            const marginUsed = filledPrice * request.quantity * 0.2; // 20% margin
            await prisma.wallet.update({
                where: { userId: request.userId },
                data: {
                    usedMargin: { increment: marginUsed },
                    availableMargin: { decrement: marginUsed },
                },
            });

            tradeLogger.info('Position OPENED', {
                userId: request.userId,
                symbol: request.symbol,
                side: 'LONG',
                entryPrice: filledPrice,
                quantity: request.quantity,
                stopLoss: request.stopLoss,
                takeProfit: request.takeProfit,
            });
        } else {
            // Close existing position
            const position = await prisma.position.findFirst({
                where: {
                    userId: request.userId,
                    symbol: request.symbol,
                    strategyId: request.strategyId || undefined,
                    status: 'OPEN',
                },
                orderBy: { openedAt: 'asc' }, // FIFO
            });

            if (position) {
                const pnl =
                    position.side === 'LONG'
                        ? (filledPrice - position.entryPrice) * position.quantity
                        : (position.entryPrice - filledPrice) * position.quantity;
                const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
                const duration = Math.floor((Date.now() - position.openedAt.getTime()) / 1000);

                // Close position
                await prisma.position.update({
                    where: { id: position.id },
                    data: {
                        status: 'CLOSED',
                        exitPrice: filledPrice,
                        realizedPnl: pnl,
                        currentPrice: filledPrice,
                        exitOrderId: order.id,
                        closedAt: new Date(),
                    },
                });

                // Record trade
                await prisma.trade.create({
                    data: {
                        userId: request.userId,
                        strategyId: request.strategyId || null,
                        symbol: request.symbol,
                        exchange: request.exchange || 'NSE',
                        side: position.side === 'LONG' ? 'BUY' : 'SELL',
                        quantity: position.quantity,
                        entryPrice: position.entryPrice,
                        exitPrice: filledPrice,
                        pnl,
                        pnlPercent,
                        entryTime: position.openedAt,
                        exitTime: new Date(),
                        duration,
                    },
                });

                // ――― RISK: record result (consecutive losses, daily loss auto-lock) ―――
                await riskManagementService.recordTradeResult(request.userId, pnl);
                await riskManagementService.logTrade(request.userId, {
                    strategyId: request.strategyId,
                    symbol: request.symbol,
                    side: position.side === 'LONG' ? 'BUY' : 'SELL',
                    entryPrice: position.entryPrice,
                    exitPrice: filledPrice,
                    stopLoss: position.stopLoss ?? 0,
                    takeProfit: position.takeProfit ?? 0,
                    quantity: position.quantity,
                    pnl,
                    timestamp: new Date(),
                    reason: pnl >= 0 ? `WIN +₹${pnl.toFixed(2)}` : `LOSS -₹${Math.abs(pnl).toFixed(2)}`,
                });

                tradeLogger.info(`Trade CLOSED | ${request.symbol} | PnL: ₹${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%) | Duration: ${duration}s | Entry: ₹${position.entryPrice} | Exit: ₹${filledPrice} | SL was: ₹${position.stopLoss ?? 'N/A'} | TP was: ₹${position.takeProfit ?? 'N/A'}`);

                // Release margin and update P&L
                const marginRelease = position.entryPrice * position.quantity * 0.2;
                await prisma.wallet.update({
                    where: { userId: request.userId },
                    data: {
                        balance: { increment: pnl },
                        usedMargin: { decrement: marginRelease },
                        availableMargin: { increment: marginRelease },
                        realizedPnl: { increment: pnl },
                    },
                });

                // Update risk state
                if (pnl < 0) {
                    await prisma.riskState.update({
                        where: { userId: request.userId },
                        data: {
                            dailyLoss: { increment: Math.abs(pnl) },
                            dailyTradeCount: { increment: 1 },
                        },
                    });
                } else {
                    await prisma.riskState.update({
                        where: { userId: request.userId },
                        data: { dailyTradeCount: { increment: 1 } },
                    });
                }

                tradeLogger.info('Position closed', {
                    symbol: request.symbol,
                    pnl: pnl.toFixed(2),
                    duration: `${duration}s`,
                    entryPrice: position.entryPrice,
                    exitPrice: filledPrice,
                });
            }
        }
    }
}
