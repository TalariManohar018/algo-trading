// ============================================================
// ANGEL ONE SmartAPI BROKER — Real broker integration
// ============================================================
// API Docs: https://smartapi.angelone.in/docs
// Flow: Login (TOTP) → Get JWT → Place/Cancel/Track orders
// WebSocket: Real-time market data via SmartAPI WebSocket
// ============================================================

import { IBrokerService, BrokerOrder, BrokerOrderResponse, BrokerOrderStatus, BrokerPosition } from '../engine/brokerService';
import logger, { tradeLogger } from '../utils/logger';
import { BrokerError } from '../utils/errors';
import { generateTOTP } from '../utils/totp';

const BASE_URL = 'https://apiconnect.angelone.in';

interface AngelOneTokens {
    jwtToken: string;
    refreshToken: string;
    feedToken: string;
}

interface AngelOneConfig {
    apiKey: string;
    clientId: string;
    mpin: string;
    totpSecret: string;
}

export class AngelOneBrokerService implements IBrokerService {
    private config: AngelOneConfig;
    private tokens: AngelOneTokens | null = null;
    private connected = false;

    constructor(config: AngelOneConfig) {
        this.config = config;
        logger.info('Angel One broker service initialized', { clientId: config.clientId });
    }

    // ─── AUTH ─────────────────────────────────────────────────

    /**
     * Login to Angel One using client ID, MPIN, and TOTP
     */
    async login(): Promise<AngelOneTokens> {
        const totp = generateTOTP(this.config.totpSecret);

        const response = await this.request('/rest/auth/angelbroking/user/v1/loginByPassword', {
            method: 'POST',
            body: JSON.stringify({
                clientcode: this.config.clientId,
                password: this.config.mpin,
                totp,
            }),
            auth: false,
        });

        if (!response.data?.jwtToken) {
            throw new BrokerError(`Angel One login failed: ${response.message || 'Unknown error'}`);
        }

        this.tokens = {
            jwtToken: response.data.jwtToken,
            refreshToken: response.data.refreshToken,
            feedToken: response.data.feedToken,
        };
        this.connected = true;

        logger.info('Angel One login successful', { clientId: this.config.clientId });
        return this.tokens;
    }

    /**
     * Refresh the JWT token using the refresh token
     */
    async refreshSession(): Promise<void> {
        if (!this.tokens?.refreshToken) {
            throw new BrokerError('No refresh token available. Please login again.');
        }

        const response = await this.request('/rest/auth/angelbroking/jwt/v1/generateTokens', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
            auth: true,
        });

        if (response.data?.jwtToken) {
            this.tokens.jwtToken = response.data.jwtToken;
            logger.info('Angel One session refreshed');
        } else {
            this.connected = false;
            throw new BrokerError('Session refresh failed. Please login again.');
        }
    }

    /**
     * Logout and invalidate tokens
     */
    async logout(): Promise<void> {
        try {
            await this.request('/rest/secure/angelbroking/user/v1/logout', {
                method: 'POST',
                body: JSON.stringify({ clientcode: this.config.clientId }),
                auth: true,
            });
        } catch {
            // Ignore logout errors
        }
        this.tokens = null;
        this.connected = false;
        logger.info('Angel One logged out');
    }

    /**
     * Get user profile
     */
    async getProfile(): Promise<any> {
        const response = await this.request('/rest/secure/angelbroking/user/v1/getProfile', {
            method: 'GET',
            auth: true,
        });
        return response.data;
    }

    // ─── ORDERS ───────────────────────────────────────────────

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        this.ensureConnected();

        const angelOrder = this.mapToAngelOrder(order);

        try {
            const response = await this.request('/rest/secure/angelbroking/order/v1/placeOrder', {
                method: 'POST',
                body: JSON.stringify(angelOrder),
                auth: true,
            });

            if (response.status && response.data?.orderid) {
                tradeLogger.info('Angel One order placed', {
                    orderId: response.data.orderid,
                    symbol: order.symbol,
                    side: order.side,
                    quantity: order.quantity,
                });

                return {
                    orderId: response.data.orderid,
                    status: 'PLACED',
                    message: response.message || 'Order placed successfully',
                };
            }

            return {
                orderId: '',
                status: 'REJECTED',
                message: response.message || 'Order placement failed',
            };
        } catch (error: any) {
            tradeLogger.error('Angel One order failed', {
                symbol: order.symbol,
                error: error.message,
            });

            return {
                orderId: '',
                status: 'REJECTED',
                message: error.message,
            };
        }
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        this.ensureConnected();

        try {
            // First get order details to know the variety
            const orderBook = await this.getOrderBook();
            const order = orderBook.find((o: any) => o.orderid === orderId);

            const response = await this.request('/rest/secure/angelbroking/order/v1/cancelOrder', {
                method: 'POST',
                body: JSON.stringify({
                    variety: order?.variety || 'NORMAL',
                    orderid: orderId,
                }),
                auth: true,
            });

            tradeLogger.info('Angel One order cancelled', { orderId });
            return response.status === true;
        } catch (error: any) {
            tradeLogger.error('Angel One cancel failed', { orderId, error: error.message });
            return false;
        }
    }

    async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
        this.ensureConnected();

        const orderBook = await this.getOrderBook();
        const order = orderBook.find((o: any) => o.orderid === orderId);

        if (!order) {
            throw new BrokerError(`Order not found: ${orderId}`);
        }

        return {
            orderId,
            status: this.mapAngelStatus(order.orderstatus),
            filledQuantity: parseInt(order.filledshares || '0'),
            averagePrice: parseFloat(order.averageprice || '0'),
            rejectedReason: order.text || undefined,
        };
    }

    // ─── MARKET DATA ──────────────────────────────────────────

    async getCurrentPrice(symbol: string, exchange = 'NSE'): Promise<number> {
        this.ensureConnected();

        // Need symboltoken for LTP query — use search if not cached
        const symbolToken = await this.getSymbolToken(symbol, exchange);

        const response = await this.request('/rest/secure/angelbroking/market/v1/quote/', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'LTP',
                exchangeTokens: { [exchange]: [symbolToken] },
            }),
            auth: true,
        });

        if (response.data?.fetched?.length > 0) {
            return parseFloat(response.data.fetched[0].ltp);
        }

        throw new BrokerError(`Could not fetch price for ${symbol}`);
    }

    /**
     * Get historical candle data from Angel One
     */
    async getHistoricalCandles(
        symbolToken: string,
        exchange: string,
        interval: string,
        fromDate: string,
        toDate: string,
    ): Promise<Array<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }>> {
        this.ensureConnected();

        const response = await this.request('/rest/secure/angelbroking/historical/v1/getCandleData', {
            method: 'POST',
            body: JSON.stringify({
                exchange,
                symboltoken: symbolToken,
                interval,  // ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, ONE_DAY
                fromdate: fromDate,  // "2024-01-01 09:15"
                todate: toDate,      // "2024-01-31 15:30"
            }),
            auth: true,
        });

        if (!response.data) return [];

        return response.data.map((candle: any[]) => ({
            timestamp: new Date(candle[0]),
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5],
        }));
    }

    // ─── POSITIONS ────────────────────────────────────────────

    async getPositions(): Promise<BrokerPosition[]> {
        this.ensureConnected();

        const response = await this.request('/rest/secure/angelbroking/order/v1/getPosition', {
            method: 'GET',
            auth: true,
        });

        if (!response.data) return [];

        return response.data.map((pos: any) => ({
            symbol: pos.tradingsymbol,
            exchange: pos.exchange,
            quantity: parseInt(pos.netqty || '0'),
            averagePrice: parseFloat(pos.averageprice || '0'),
            lastPrice: parseFloat(pos.ltp || '0'),
            pnl: parseFloat(pos.pnl || '0'),
            product: pos.producttype,
        }));
    }

    async squareOffAll(): Promise<void> {
        this.ensureConnected();

        const positions = await this.getPositions();
        const openPositions = positions.filter(p => p.quantity !== 0);

        for (const pos of openPositions) {
            const side = pos.quantity > 0 ? 'SELL' : 'BUY';
            const quantity = Math.abs(pos.quantity);

            await this.placeOrder({
                symbol: pos.symbol,
                exchange: pos.exchange,
                side,
                quantity,
                orderType: 'MARKET',
                product: pos.product as any,
            });

            tradeLogger.warn('Position squared off', {
                symbol: pos.symbol,
                side,
                quantity,
            });
        }
    }

    async cancelAllOrders(): Promise<void> {
        this.ensureConnected();

        const orderBook = await this.getOrderBook();
        const pendingOrders = orderBook.filter(
            (o: any) => o.orderstatus === 'open' || o.orderstatus === 'pending' || o.orderstatus === 'trigger pending'
        );

        for (const order of pendingOrders) {
            await this.cancelOrder(order.orderid);
        }

        tradeLogger.warn('All pending orders cancelled', { count: pendingOrders.length });
    }

    isConnected(): boolean {
        return this.connected && !!this.tokens?.jwtToken;
    }

    getTokens(): AngelOneTokens | null {
        return this.tokens;
    }

    /**
     * Set tokens externally (e.g. loaded from DB)
     */
    setTokens(tokens: AngelOneTokens): void {
        this.tokens = tokens;
        this.connected = true;
    }

    // ─── HELPERS ──────────────────────────────────────────────

    private async getOrderBook(): Promise<any[]> {
        const response = await this.request('/rest/secure/angelbroking/order/v1/getOrderBook', {
            method: 'GET',
            auth: true,
        });
        return response.data || [];
    }

    private async getSymbolToken(symbol: string, exchange: string): Promise<string> {
        // Common NSE equity symbol tokens (hardcoded for speed; in production load from instrument master)
        const tokenMap: Record<string, string> = {
            'NIFTY': '99926000',
            'BANKNIFTY': '99926009',
            'RELIANCE': '2885',
            'TCS': '11536',
            'INFY': '1594',
            'HDFCBANK': '1333',
            'ICICIBANK': '4963',
            'SBIN': '3045',
            'ITC': '1660',
            'TATAMOTORS': '3456',
            'WIPRO': '3787',
            'BAJFINANCE': '317',
            'HINDUNILVR': '1394',
            'KOTAKBANK': '1922',
            'LT': '11483',
            'AXISBANK': '5900',
            'MARUTI': '10999',
            'ADANIENT': '25',
            'TITAN': '3506',
            'SUNPHARMA': '3351',
            'NIFTY 50': '99926000',
            'NIFTY BANK': '99926009',
        };

        const key = symbol.toUpperCase();
        if (tokenMap[key]) return tokenMap[key];

        // Search via API
        const response = await this.request('/rest/secure/angelbroking/order/v1/searchScrip', {
            method: 'POST',
            body: JSON.stringify({ exchange, searchscrip: symbol }),
            auth: true,
        });

        if (response.data?.length > 0) {
            return response.data[0].symboltoken;
        }

        throw new BrokerError(`Symbol token not found for: ${symbol}`);
    }

    private mapToAngelOrder(order: BrokerOrder): any {
        // Map our order types to Angel One format
        let ordertype = 'MARKET';
        let variety = 'NORMAL';

        switch (order.orderType) {
            case 'LIMIT':
                ordertype = 'LIMIT';
                break;
            case 'SL':
                ordertype = 'STOPLOSS_LIMIT';
                variety = 'STOPLOSS';
                break;
            case 'SL-M':
                ordertype = 'STOPLOSS_MARKET';
                variety = 'STOPLOSS';
                break;
        }

        // Map product type
        let producttype = 'INTRADAY';
        switch (order.product) {
            case 'NRML':
                producttype = 'CARRYFORWARD';
                break;
            case 'CNC':
                producttype = 'DELIVERY';
                break;
        }

        return {
            variety,
            tradingsymbol: order.symbol,
            symboltoken: '', // Will be resolved
            transactiontype: order.side,
            exchange: order.exchange || 'NSE',
            ordertype,
            producttype,
            duration: 'DAY',
            price: order.limitPrice?.toString() || '0',
            triggerprice: order.triggerPrice?.toString() || '0',
            quantity: order.quantity.toString(),
            squareoff: '0',
            stoploss: '0',
        };
    }

    private mapAngelStatus(status: string): 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED' {
        const s = status?.toLowerCase() || '';
        if (s === 'complete') return 'COMPLETE';
        if (s === 'cancelled') return 'CANCELLED';
        if (s === 'rejected') return 'REJECTED';
        return 'OPEN'; // open, pending, trigger pending, etc.
    }

    private ensureConnected(): void {
        if (!this.connected || !this.tokens?.jwtToken) {
            throw new BrokerError('Not connected to Angel One. Please login first.');
        }
    }

    private async request(
        path: string,
        options: { method: string; body?: string; auth: boolean },
    ): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': '00:00:00:00:00:00',
            'X-PrivateKey': this.config.apiKey,
        };

        if (options.auth && this.tokens?.jwtToken) {
            headers['Authorization'] = `Bearer ${this.tokens.jwtToken}`;
        }

        const url = `${BASE_URL}${path}`;

        try {
            const response = await fetch(url, {
                method: options.method,
                headers,
                body: options.body,
            });

            const data: any = await response.json();

            if (!response.ok) {
                throw new BrokerError(`Angel One API error (${response.status}): ${data.message || JSON.stringify(data)}`);
            }

            return data;
        } catch (error: any) {
            if (error instanceof BrokerError) throw error;
            throw new BrokerError(`Angel One request failed: ${error.message}`);
        }
    }
}
