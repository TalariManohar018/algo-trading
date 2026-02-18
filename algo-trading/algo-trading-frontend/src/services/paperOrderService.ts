import type { Order, OrderStatus, OrderConfig } from '../types/trading';
import { EventEmitter } from '../utils/EventEmitter';

// OrderConfig is imported from types/trading

const DEFAULT_CONFIG: OrderConfig = {
    placementDelayMs: 150,
    fillDelayMs: 300,
    slippagePercent: 0.0005,
    rejectionRate: 0.03,
    partialFillProbability: 0.15,
    partialFillMinPercent: 0.3,
};

class PaperOrderService extends EventEmitter {
    private config: OrderConfig;
    private pendingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    constructor() {
        super();
        this.config = { ...DEFAULT_CONFIG };
    }

    configure(config: Partial<OrderConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): OrderConfig {
        return { ...this.config };
    }

    private generateId(): string {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    async createOrder(params: {
        strategyId: string;
        strategyName: string;
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        orderType: 'MARKET' | 'LIMIT';
        limitPrice?: number;
    }): Promise<Order> {
        const order: Order = {
            id: this.generateId(),
            strategyId: params.strategyId,
            strategyName: params.strategyName,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            orderType: params.orderType,
            limitPrice: params.limitPrice,
            status: 'CREATED',
            createdAt: new Date(),
            filledQuantity: 0,
        };

        this.emit('order:created', order);
        return order;
    }

    async placeOrder(order: Order, currentPrice: number): Promise<Order> {
        return new Promise((resolve) => {
            const t = setTimeout(() => {
                this.pendingTimers.delete(order.id);

                if (Math.random() < this.config.rejectionRate) {
                    const rejected: Order = {
                        ...order,
                        status: 'REJECTED',
                        rejectedReason: 'Simulated rejection: margin or circuit limit',
                        placedAt: new Date(),
                    };
                    this.emit('order:rejected', rejected);
                    resolve(rejected);
                    return;
                }

                const slippage = currentPrice * this.config.slippagePercent * (Math.random() * 0.5 + 0.5);
                const fillPrice = order.side === 'BUY'
                    ? currentPrice + slippage
                    : currentPrice - slippage;
                const roundedPrice = Math.round(fillPrice * 100) / 100;

                const placed: Order = {
                    ...order,
                    status: 'PLACED',
                    placedPrice: roundedPrice,
                    placedAt: new Date(),
                };
                this.emit('order:placed', placed);

                this.scheduleFill(placed, roundedPrice, resolve);
            }, this.config.placementDelayMs);

            this.pendingTimers.set(order.id, t);
        });
    }

    private scheduleFill(order: Order, fillPrice: number, resolve: (o: Order) => void): void {
        const t = setTimeout(() => {
            this.pendingTimers.delete(order.id);

            if (Math.random() < this.config.partialFillProbability && order.quantity > 1) {
                const minQty = Math.max(1, Math.floor(order.quantity * this.config.partialFillMinPercent));
                const filledQty = minQty + Math.floor(Math.random() * (order.quantity - minQty));
                const partial: Order = {
                    ...order,
                    status: 'PARTIALLY_FILLED' as OrderStatus,
                    filledPrice: fillPrice,
                    filledQuantity: filledQty,
                    filledAt: new Date(),
                };
                this.emit('order:partialFill', partial);

                setTimeout(() => {
                    const filled: Order = { ...partial, status: 'FILLED', filledQuantity: order.quantity, filledAt: new Date() };
                    this.emit('order:filled', filled);
                    resolve(filled);
                }, this.config.fillDelayMs * 0.5);
                return;
            }

            const filled: Order = {
                ...order,
                status: 'FILLED',
                filledPrice: fillPrice,
                filledQuantity: order.quantity,
                filledAt: new Date(),
            };
            this.emit('order:filled', filled);
            resolve(filled);
        }, this.config.fillDelayMs);

        this.pendingTimers.set(order.id, t);
    }

    async cancelOrder(order: Order): Promise<Order> {
        const t = this.pendingTimers.get(order.id);
        if (t) { clearTimeout(t); this.pendingTimers.delete(order.id); }
        const cancelled: Order = { ...order, status: 'CANCELLED' as OrderStatus, rejectedReason: 'Cancelled by user' };
        this.emit('order:cancelled', cancelled);
        return cancelled;
    }

    cancelAllPending(): void {
        this.pendingTimers.forEach((t) => clearTimeout(t));
        this.pendingTimers.clear();
    }

    getPendingCount(): number {
        return this.pendingTimers.size;
    }
}

export const paperOrderService = new PaperOrderService();
