// ============================================================
// BROKER SERVICE — Abstraction layer for broker APIs
// ============================================================
// Supports: Paper trading (mock) and Zerodha Kite Connect.
// The engine always calls BrokerService; the implementation
// is swapped based on TRADING_MODE config.
// ============================================================

import { env } from '../config/env';
import logger, { tradeLogger } from '../utils/logger';
import { BrokerError } from '../utils/errors';

export interface BrokerOrder {
    symbol: string;
    exchange: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    product: 'MIS' | 'NRML' | 'CNC';
    limitPrice?: number;
    triggerPrice?: number;
}

export interface BrokerOrderResponse {
    orderId: string;
    status: 'PLACED' | 'REJECTED';
    message: string;
}

export interface BrokerOrderStatus {
    orderId: string;
    status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
    filledQuantity: number;
    averagePrice: number;
    rejectedReason?: string;
}

export interface BrokerPosition {
    symbol: string;
    exchange: string;
    quantity: number;
    averagePrice: number;
    lastPrice: number;
    pnl: number;
    product: string;
}

export interface IBrokerService {
    placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse>;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrderStatus(orderId: string): Promise<BrokerOrderStatus>;
    getCurrentPrice(symbol: string, exchange?: string): Promise<number>;
    getPositions(): Promise<BrokerPosition[]>;
    squareOffAll(): Promise<void>;
    cancelAllOrders(): Promise<void>;
    isConnected(): boolean;
}

// ─── PAPER BROKER (Mock) ────────────────────────────────────

export class PaperBrokerService implements IBrokerService {
    private orderCounter = 0;
    private orders = new Map<string, { order: BrokerOrder; status: BrokerOrderStatus }>();
    private prices = new Map<string, number>();

    constructor() {
        // Seed realistic IST market prices
        this.prices.set('NIFTY', 22450);
        this.prices.set('BANKNIFTY', 48200);
        this.prices.set('RELIANCE', 2480);
        this.prices.set('TCS', 3920);
        this.prices.set('INFY', 1570);
        this.prices.set('HDFCBANK', 1640);
        this.prices.set('ICICIBANK', 1060);
        this.prices.set('SBIN', 785);
        this.prices.set('ITC', 445);
        this.prices.set('TATAMOTORS', 950);
    }

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        const orderId = `PAPER_${++this.orderCounter}_${Date.now()}`;

        // Simulate 2% rejection rate
        if (Math.random() < 0.02) {
            this.orders.set(orderId, {
                order,
                status: {
                    orderId,
                    status: 'REJECTED',
                    filledQuantity: 0,
                    averagePrice: 0,
                    rejectedReason: 'Simulated rejection (paper trading)',
                },
            });
            return { orderId, status: 'REJECTED', message: 'Simulated rejection' };
        }

        // Simulate fill with 0.01-0.05% slippage
        const basePrice = order.limitPrice || (await this.getCurrentPrice(order.symbol));
        const slippagePercent = (Math.random() * 0.04 + 0.01) / 100;
        const slippage = order.side === 'BUY' ? 1 + slippagePercent : 1 - slippagePercent;
        const filledPrice = Math.round(basePrice * slippage * 100) / 100;

        this.orders.set(orderId, {
            order,
            status: {
                orderId,
                status: 'COMPLETE',
                filledQuantity: order.quantity,
                averagePrice: filledPrice,
            },
        });

        tradeLogger.info('Paper order filled', {
            orderId,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price: filledPrice,
        });

        return { orderId, status: 'PLACED', message: `Paper order filled at ${filledPrice}` };
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        const entry = this.orders.get(orderId);
        if (entry && entry.status.status === 'OPEN') {
            entry.status.status = 'CANCELLED';
            return true;
        }
        return false;
    }

    async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
        const entry = this.orders.get(orderId);
        if (!entry) throw new BrokerError(`Order not found: ${orderId}`);
        return entry.status;
    }

    async getCurrentPrice(symbol: string): Promise<number> {
        const base = this.prices.get(symbol) || 1000;
        // Simulate small tick movement (±0.1%)
        const movement = 1 + (Math.random() - 0.5) * 0.002;
        const newPrice = Math.round(base * movement * 100) / 100;
        this.prices.set(symbol, newPrice);
        return newPrice;
    }

    async getPositions(): Promise<BrokerPosition[]> {
        return [];
    }

    async squareOffAll(): Promise<void> {
        tradeLogger.warn('Paper broker: squareOffAll called');
    }

    async cancelAllOrders(): Promise<void> {
        for (const [id, entry] of this.orders) {
            if (entry.status.status === 'OPEN') {
                entry.status.status = 'CANCELLED';
            }
        }
    }

    isConnected(): boolean {
        return true;
    }
}

// ─── ZERODHA KITE BROKER ────────────────────────────────────

export class ZerodhaBrokerService implements IBrokerService {
    private baseUrl = 'https://api.kite.trade';
    private apiKey: string;
    private accessToken: string;

    constructor(apiKey: string, accessToken: string) {
        this.apiKey = apiKey;
        this.accessToken = accessToken;
        logger.info('Zerodha broker service initialized');
    }

    private get headers(): Record<string, string> {
        return {
            'X-Kite-Version': '3',
            Authorization: `token ${this.apiKey}:${this.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };
    }

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        try {
            const params = new URLSearchParams({
                tradingsymbol: order.symbol,
                exchange: order.exchange,
                transaction_type: order.side,
                quantity: order.quantity.toString(),
                order_type: order.orderType,
                product: order.product,
                validity: 'DAY',
            });

            if (order.limitPrice) params.append('price', order.limitPrice.toString());
            if (order.triggerPrice) params.append('trigger_price', order.triggerPrice.toString());

            const response = await fetch(`${this.baseUrl}/orders/regular`, {
                method: 'POST',
                headers: this.headers,
                body: params.toString(),
            });

            const data = await response.json() as any;

            if (data.status === 'success') {
                tradeLogger.info('Zerodha order placed', {
                    orderId: data.data.order_id,
                    symbol: order.symbol,
                    side: order.side,
                });
                return {
                    orderId: data.data.order_id,
                    status: 'PLACED',
                    message: 'Order placed successfully',
                };
            }

            tradeLogger.error('Zerodha order rejected', { error: data.message });
            return {
                orderId: '',
                status: 'REJECTED',
                message: data.message || 'Order rejected by Zerodha',
            };
        } catch (error: any) {
            throw new BrokerError(`Failed to place order: ${error.message}`);
        }
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/orders/regular/${orderId}`, {
                method: 'DELETE',
                headers: this.headers,
            });
            const data = await response.json() as any;
            return data.status === 'success';
        } catch (error: any) {
            throw new BrokerError(`Failed to cancel order: ${error.message}`);
        }
    }

    async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
        try {
            const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
                method: 'GET',
                headers: this.headers,
            });
            const data = await response.json() as any;

            if (data.status !== 'success') throw new BrokerError('Failed to get order status');

            const order = data.data[data.data.length - 1]; // Latest status
            return {
                orderId: order.order_id,
                status: this.mapKiteStatus(order.status),
                filledQuantity: order.filled_quantity || 0,
                averagePrice: order.average_price || 0,
                rejectedReason: order.status_message,
            };
        } catch (error: any) {
            throw new BrokerError(`Failed to get order status: ${error.message}`);
        }
    }

    async getCurrentPrice(symbol: string, exchange = 'NSE'): Promise<number> {
        try {
            const response = await fetch(`${this.baseUrl}/quote?i=${exchange}:${symbol}`, {
                headers: this.headers,
            });
            const data = await response.json() as any;
            return data.data[`${exchange}:${symbol}`].last_price;
        } catch (error: any) {
            throw new BrokerError(`Failed to get price for ${symbol}: ${error.message}`);
        }
    }

    async getPositions(): Promise<BrokerPosition[]> {
        try {
            const response = await fetch(`${this.baseUrl}/portfolio/positions`, {
                headers: this.headers,
            });
            const data = await response.json() as any;
            if (data.status !== 'success') return [];

            return data.data.net.map((p: any) => ({
                symbol: p.tradingsymbol,
                exchange: p.exchange,
                quantity: p.quantity,
                averagePrice: p.average_price,
                lastPrice: p.last_price,
                pnl: p.pnl,
                product: p.product,
            }));
        } catch {
            return [];
        }
    }

    async squareOffAll(): Promise<void> {
        const positions = await this.getPositions();
        for (const pos of positions) {
            if (pos.quantity !== 0) {
                await this.placeOrder({
                    symbol: pos.symbol,
                    exchange: pos.exchange,
                    side: pos.quantity > 0 ? 'SELL' : 'BUY',
                    quantity: Math.abs(pos.quantity),
                    orderType: 'MARKET',
                    product: pos.product as any,
                });
            }
        }
    }

    async cancelAllOrders(): Promise<void> {
        // Zerodha doesn't have a cancel-all endpoint; would need to list then cancel each
        logger.warn('Zerodha cancelAllOrders: not implemented — use dashboard');
    }

    isConnected(): boolean {
        return !!this.accessToken;
    }

    private mapKiteStatus(status: string): 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED' {
        const map: Record<string, 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED'> = {
            COMPLETE: 'COMPLETE',
            CANCELLED: 'CANCELLED',
            REJECTED: 'REJECTED',
            'OPEN': 'OPEN',
            'OPEN PENDING': 'OPEN',
            'VALIDATION PENDING': 'OPEN',
            'PUT ORDER REQ RECEIVED': 'OPEN',
            TRIGGER_PENDING: 'OPEN',
        };
        return map[status] || 'OPEN';
    }
}

// ─── FACTORY ────────────────────────────────────────────────

export function createBrokerService(): IBrokerService {
    if (env.TRADING_MODE === 'live' && env.KITE_API_KEY && env.KITE_ACCESS_TOKEN) {
        logger.warn('⚠️  LIVE TRADING MODE ENABLED');
        return new ZerodhaBrokerService(env.KITE_API_KEY, env.KITE_ACCESS_TOKEN);
    }

    logger.info('Paper trading mode active');
    return new PaperBrokerService();
}
