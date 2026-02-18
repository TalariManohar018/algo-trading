// ============================================================
// PAPER BROKER — Simulated broker for paper trading
// ============================================================
// Realistic simulation: random slippage, occasional rejection,
// immediate fills for market orders, delay for limit orders.
// ============================================================

import {
    IBrokerService,
    BrokerOrder,
    BrokerOrderResponse,
    BrokerOrderStatus,
    BrokerPosition,
} from './brokerInterface';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger';

// Simulated stock prices (INR)
const MOCK_PRICES: Record<string, number> = {
    NIFTY: 21500,
    BANKNIFTY: 47200,
    RELIANCE: 2450,
    TCS: 3820,
    INFY: 1580,
    HDFCBANK: 1620,
    ICICIBANK: 1050,
    SBIN: 760,
    ITC: 440,
    HINDUNILVR: 2530,
    TATAMOTORS: 950,
    WIPRO: 480,
    BAJFINANCE: 6900,
    LT: 3450,
    ADANIENT: 2800,
};

interface MockOrderState {
    order: BrokerOrder;
    status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
    filledPrice: number;
    filledQuantity: number;
}

export class PaperBrokerService implements IBrokerService {
    readonly mode = 'paper' as const;
    private orders = new Map<string, MockOrderState>();
    private prices = new Map<string, number>(Object.entries(MOCK_PRICES));
    private connected = true;

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        const orderId = `PAPER-${uuid().slice(0, 8)}`;

        // 3% random rejection rate
        if (Math.random() < 0.03) {
            this.orders.set(orderId, {
                order,
                status: 'REJECTED',
                filledPrice: 0,
                filledQuantity: 0,
            });
            return { orderId, status: 'REJECTED', message: 'Simulated rejection: Insufficient margin' };
        }

        // Get current price with random slippage (0-0.15%)
        const basePrice = this.getPrice(order.symbol);
        const slippage = basePrice * (Math.random() * 0.0015);
        const filledPrice =
            order.orderType === 'MARKET'
                ? order.side === 'BUY'
                    ? basePrice + slippage
                    : basePrice - slippage
                : order.limitPrice || basePrice;

        this.orders.set(orderId, {
            order,
            status: 'COMPLETE',
            filledPrice: Math.round(filledPrice * 100) / 100,
            filledQuantity: order.quantity,
        });

        logger.debug(`Paper order placed: ${order.side} ${order.quantity}x ${order.symbol} @ ${filledPrice.toFixed(2)}`);

        return { orderId, status: 'PLACED' };
    }

    async cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
        const state = this.orders.get(orderId);
        if (!state) return { success: false, message: 'Order not found' };
        if (state.status === 'COMPLETE') return { success: false, message: 'Order already filled' };
        state.status = 'CANCELLED';
        return { success: true };
    }

    async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
        const state = this.orders.get(orderId);
        if (!state) {
            return { orderId, status: 'REJECTED', filledQuantity: 0, averagePrice: 0, message: 'Order not found' };
        }
        return {
            orderId,
            status: state.status,
            filledQuantity: state.filledQuantity,
            averagePrice: state.filledPrice,
        };
    }

    async getCurrentPrice(symbol: string): Promise<number> {
        return this.getPrice(symbol);
    }

    async getPositions(): Promise<BrokerPosition[]> {
        return []; // Paper broker doesn't track positions (DB does)
    }

    async squareOffAll(): Promise<{ success: boolean; closedCount: number }> {
        return { success: true, closedCount: 0 };
    }

    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Get simulated price with small random walk
     */
    private getPrice(symbol: string): number {
        let price = this.prices.get(symbol) || 1000;
        // Random walk: ±0.3%
        const change = price * (Math.random() - 0.5) * 0.006;
        price += change;
        this.prices.set(symbol, price);
        return Math.round(price * 100) / 100;
    }
}
