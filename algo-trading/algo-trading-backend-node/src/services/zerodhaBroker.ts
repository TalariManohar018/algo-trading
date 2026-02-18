// ============================================================
// ZERODHA KITE CONNECT — Live broker integration
// ============================================================
// Uses Kite Connect v3 REST APIs.
// WebSocket tick data handled separately in marketDataService.
//
// IMPORTANT: Never hardcode credentials. Use env vars.
// Access token must be refreshed daily via login flow.
// ============================================================

import {
    IBrokerService,
    BrokerOrder,
    BrokerOrderResponse,
    BrokerOrderStatus,
    BrokerPosition,
} from './brokerInterface';
import { env } from '../config/env';
import { BrokerError } from '../utils/errors';
import logger from '../utils/logger';

const KITE_BASE_URL = 'https://api.kite.trade';

export class ZerodhaBrokerService implements IBrokerService {
    readonly mode = 'live' as const;
    private apiKey: string;
    private accessToken: string;
    private connected = false;

    constructor() {
        this.apiKey = env.KITE_API_KEY;
        this.accessToken = env.KITE_ACCESS_TOKEN;
        if (this.apiKey && this.accessToken) {
            this.connected = true;
        }
    }

    setAccessToken(token: string) {
        this.accessToken = token;
        this.connected = true;
        logger.info('Zerodha access token updated');
    }

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        this.ensureConnected();

        try {
            const params = new URLSearchParams({
                tradingsymbol: order.symbol,
                exchange: order.exchange,
                transaction_type: order.side,
                order_type: order.orderType,
                quantity: order.quantity.toString(),
                product: order.product,
                validity: 'DAY',
            });

            if (order.limitPrice) params.set('price', order.limitPrice.toString());
            if (order.triggerPrice) params.set('trigger_price', order.triggerPrice.toString());

            const response = await fetch(`${KITE_BASE_URL}/orders/regular`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: params,
            });

            const data: any = await response.json();

            if (data.status === 'success') {
                logger.info(`Zerodha order placed: ${data.data.order_id}`, {
                    symbol: order.symbol,
                    side: order.side,
                    qty: order.quantity,
                });
                return { orderId: data.data.order_id, status: 'PLACED' };
            }

            return {
                orderId: '',
                status: 'REJECTED',
                message: data.message || 'Order rejected by Zerodha',
            };
        } catch (error: any) {
            logger.error(`Zerodha placeOrder failed: ${error.message}`);
            throw new BrokerError(error.message);
        }
    }

    async cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
        this.ensureConnected();

        try {
            const response = await fetch(`${KITE_BASE_URL}/orders/regular/${orderId}`, {
                method: 'DELETE',
                headers: this.getHeaders(),
            });

            const data: any = await response.json();
            return { success: data.status === 'success', message: data.message };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
        this.ensureConnected();

        try {
            const response = await fetch(`${KITE_BASE_URL}/orders/${orderId}`, {
                headers: this.getHeaders(),
            });

            const data: any = await response.json();

            if (data.status !== 'success' || !data.data?.length) {
                return { orderId, status: 'REJECTED', filledQuantity: 0, averagePrice: 0 };
            }

            const order = data.data[data.data.length - 1]; // Latest status
            const statusMap: Record<string, BrokerOrderStatus['status']> = {
                COMPLETE: 'COMPLETE',
                OPEN: 'OPEN',
                CANCELLED: 'CANCELLED',
                REJECTED: 'REJECTED',
            };

            return {
                orderId,
                status: statusMap[order.status] || 'OPEN',
                filledQuantity: order.filled_quantity || 0,
                averagePrice: order.average_price || 0,
            };
        } catch (error: any) {
            throw new BrokerError(`Failed to get order status: ${error.message}`);
        }
    }

    async getCurrentPrice(symbol: string, exchange = 'NSE'): Promise<number> {
        this.ensureConnected();

        try {
            const response = await fetch(
                `${KITE_BASE_URL}/quote?i=${exchange}:${symbol}`,
                { headers: this.getHeaders() }
            );

            const data: any = await response.json();
            const key = `${exchange}:${symbol}`;

            if (data.status === 'success' && data.data?.[key]) {
                return data.data[key].last_price;
            }

            throw new Error(`No price data for ${key}`);
        } catch (error: any) {
            throw new BrokerError(`Failed to get price: ${error.message}`);
        }
    }

    async getPositions(): Promise<BrokerPosition[]> {
        this.ensureConnected();

        try {
            const response = await fetch(`${KITE_BASE_URL}/portfolio/positions`, {
                headers: this.getHeaders(),
            });

            const data: any = await response.json();
            if (data.status !== 'success') return [];

            const positions: BrokerPosition[] = [];
            for (const pos of [...(data.data?.day || []), ...(data.data?.net || [])]) {
                if (pos.quantity !== 0) {
                    positions.push({
                        symbol: pos.tradingsymbol,
                        quantity: pos.quantity,
                        averagePrice: pos.average_price,
                        lastPrice: pos.last_price,
                        pnl: pos.pnl,
                        product: pos.product,
                    });
                }
            }

            return positions;
        } catch (error: any) {
            throw new BrokerError(`Failed to get positions: ${error.message}`);
        }
    }

    async squareOffAll(): Promise<{ success: boolean; closedCount: number }> {
        const positions = await this.getPositions();
        let closedCount = 0;

        for (const pos of positions) {
            try {
                await this.placeOrder({
                    symbol: pos.symbol,
                    exchange: 'NSE',
                    side: pos.quantity > 0 ? 'SELL' : 'BUY',
                    quantity: Math.abs(pos.quantity),
                    orderType: 'MARKET',
                    product: pos.product as any,
                });
                closedCount++;
            } catch (error) {
                logger.error(`Failed to square off ${pos.symbol}`, { error });
            }
        }

        return { success: true, closedCount };
    }

    isConnected(): boolean {
        return this.connected;
    }

    private ensureConnected(): void {
        if (!this.connected || !this.accessToken) {
            throw new BrokerError('Not connected to Zerodha. Set access token first.');
        }
    }

    private getHeaders(): Record<string, string> {
        return {
            'X-Kite-Version': '3',
            Authorization: `token ${this.apiKey}:${this.accessToken}`,
        };
    }
}
