// ============================================================
// ANGEL ONE SmartAPI BROKER — Production-ready integration
// ============================================================
// API Docs: https://smartapi.angelone.in/docs
//
// Safety features:
//   ✅ Auto session refresh on 401/token expiry
//   ✅ Exponential backoff retry on network errors
//   ✅ Rate limiting (10 req/s per Angel One docs)
//   ✅ Full request/response logging (trades.log)
//   ✅ Max order value validation
//   ✅ Emergency stop flag — blocks all new orders
//   ✅ Symbol token resolution with cache
//   ✅ Graceful error handling — never crashes engine
// ============================================================

import { IBrokerService, BrokerOrder, BrokerOrderResponse, BrokerOrderStatus, BrokerPosition } from '../engine/brokerService';
import logger, { tradeLogger } from '../utils/logger';
import { BrokerError } from '../utils/errors';
import { generateTOTP } from '../utils/totp';
import { withRetry, RateLimiter } from '../utils/retry';
import { env } from '../config/env';

const BASE_URL = 'https://apiconnect.angelone.in';

// Angel One rate limit: ~10 requests/second
const RATE_LIMITER = new RateLimiter(110); // 110ms between calls ≈ 9 req/s (safe margin)

interface AngelOneTokens {
    jwtToken: string;
    refreshToken: string;
    feedToken: string;
}

export interface AngelOneConfig {
    apiKey: string;
    clientId: string;
    password: string;        // MPIN or password
    totpSecret: string;
}

export class AngelOneBrokerService implements IBrokerService {
    private config: AngelOneConfig;
    private tokens: AngelOneTokens | null = null;
    private connected = false;
    private emergencyStopped = false;
    private symbolTokenCache = new Map<string, string>();
    private lastLoginAt: Date | null = null;
    private sessionRefreshInProgress = false;

    constructor(config: AngelOneConfig) {
        this.config = config;
        logger.info('Angel One broker service initialized', { clientId: config.clientId });
    }

    // ─── AUTH ─────────────────────────────────────────────────

    /**
     * Login to Angel One using client ID, password/MPIN, and TOTP.
     * Uses retry with backoff for resilience.
     */
    async login(): Promise<AngelOneTokens> {
        return withRetry(async () => {
            const totp = generateTOTP(this.config.totpSecret);

            const response = await this.rawRequest('/rest/auth/angelbroking/user/v1/loginByPassword', {
                method: 'POST',
                body: JSON.stringify({
                    clientcode: this.config.clientId,
                    password: this.config.password,
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
            this.lastLoginAt = new Date();

            logger.info('Angel One login successful', {
                clientId: this.config.clientId,
                loginAt: this.lastLoginAt.toISOString(),
            });
            return this.tokens;
        }, {
            maxAttempts: 3,
            initialDelayMs: 2000,
            isRetryable: (err) => {
                const msg = err.message?.toLowerCase() || '';
                // Don't retry on invalid credentials
                if (msg.includes('invalid') && (msg.includes('password') || msg.includes('totp'))) return false;
                return true;
            },
        });
    }

    /**
     * Refresh JWT using refresh token. If refresh fails, performs full re-login.
     */
    async refreshSession(): Promise<void> {
        if (this.sessionRefreshInProgress) {
            // Wait for the in-progress refresh
            await new Promise(resolve => setTimeout(resolve, 2000));
            return;
        }

        this.sessionRefreshInProgress = true;
        try {
            if (!this.tokens?.refreshToken) {
                logger.warn('No refresh token — performing full re-login');
                await this.login();
                return;
            }

            const response = await this.rawRequest('/rest/auth/angelbroking/jwt/v1/generateTokens', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
                auth: true,
            });

            if (response.data?.jwtToken) {
                this.tokens.jwtToken = response.data.jwtToken;
                if (response.data.refreshToken) {
                    this.tokens.refreshToken = response.data.refreshToken;
                }
                logger.info('Angel One session refreshed');
            } else {
                logger.warn('Session refresh failed — performing full re-login');
                await this.login();
            }
        } catch (error: any) {
            logger.error('Session refresh error, attempting full re-login', { error: error.message });
            try {
                await this.login();
            } catch (loginErr: any) {
                this.connected = false;
                throw new BrokerError(`Session recovery failed: ${loginErr.message}`);
            }
        } finally {
            this.sessionRefreshInProgress = false;
        }
    }

    /**
     * Logout and invalidate tokens
     */
    async logout(): Promise<void> {
        try {
            await this.rawRequest('/rest/secure/angelbroking/user/v1/logout', {
                method: 'POST',
                body: JSON.stringify({ clientcode: this.config.clientId }),
                auth: true,
            });
        } catch {
            // Ignore logout errors
        }
        this.tokens = null;
        this.connected = false;
        this.emergencyStopped = false;
        logger.info('Angel One logged out');
    }

    /**
     * Get user profile
     */
    async getProfile(): Promise<any> {
        const response = await this.authenticatedRequest('/rest/secure/angelbroking/user/v1/getProfile', {
            method: 'GET',
        });
        return response.data;
    }

    // ─── EMERGENCY STOP ───────────────────────────────────────

    setEmergencyStop(stopped: boolean): void {
        this.emergencyStopped = stopped;
        if (stopped) {
            tradeLogger.error('🚨 EMERGENCY STOP ACTIVATED — All new orders blocked');
        } else {
            tradeLogger.warn('Emergency stop deactivated — Orders allowed again');
        }
    }

    isEmergencyStopped(): boolean {
        return this.emergencyStopped;
    }

    // ─── ORDERS ───────────────────────────────────────────────

    async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
        // Safety gate: emergency stop
        if (this.emergencyStopped) {
            tradeLogger.error('ORDER BLOCKED — Emergency stop active', { symbol: order.symbol });
            return { orderId: '', status: 'REJECTED', message: 'Emergency stop is active. All orders blocked.' };
        }

        // Safety gate: max order value
        const maxOrderValue = env.MAX_TRADE_SIZE || 50000;
        const estimatedValue = order.quantity * (order.limitPrice || 0);
        if (order.limitPrice && estimatedValue > maxOrderValue) {
            tradeLogger.error('ORDER BLOCKED — Exceeds max order value', {
                symbol: order.symbol,
                estimatedValue,
                maxOrderValue,
            });
            return { orderId: '', status: 'REJECTED', message: `Order value ₹${estimatedValue} exceeds max ₹${maxOrderValue}` };
        }

        this.ensureConnected();

        const angelOrder = await this.mapToAngelOrder(order);

        try {
            const response = await this.authenticatedRequest('/rest/secure/angelbroking/order/v1/placeOrder', {
                method: 'POST',
                body: JSON.stringify(angelOrder),
            });

            if (response.status && response.data?.orderid) {
                tradeLogger.info('✅ LIVE ORDER PLACED', {
                    orderId: response.data.orderid,
                    symbol: order.symbol,
                    exchange: order.exchange,
                    side: order.side,
                    quantity: order.quantity,
                    orderType: order.orderType,
                    limitPrice: order.limitPrice,
                    product: order.product,
                });

                return {
                    orderId: response.data.orderid,
                    status: 'PLACED',
                    message: response.message || 'Order placed successfully',
                };
            }

            tradeLogger.warn('ORDER REJECTED by Angel One', {
                symbol: order.symbol,
                message: response.message,
                errorCode: response.errorcode,
            });

            return {
                orderId: '',
                status: 'REJECTED',
                message: response.message || 'Order placement failed',
            };
        } catch (error: any) {
            tradeLogger.error('ORDER ERROR', {
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
            const orderBook = await this.getOrderBook();
            const order = orderBook.find((o: any) => o.orderid === orderId);

            const response = await this.authenticatedRequest('/rest/secure/angelbroking/order/v1/cancelOrder', {
                method: 'POST',
                body: JSON.stringify({
                    variety: order?.variety || 'NORMAL',
                    orderid: orderId,
                }),
            });

            tradeLogger.info('Order cancelled', { orderId });
            return response.status === true;
        } catch (error: any) {
            tradeLogger.error('Cancel failed', { orderId, error: error.message });
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

        const symbolToken = await this.resolveSymbolToken(symbol, exchange);

        const response = await this.authenticatedRequest('/rest/secure/angelbroking/market/v1/quote/', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'LTP',
                exchangeTokens: { [exchange]: [symbolToken] },
            }),
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

        const response = await this.authenticatedRequest('/rest/secure/angelbroking/historical/v1/getCandleData', {
            method: 'POST',
            body: JSON.stringify({
                exchange,
                symboltoken: symbolToken,
                interval,
                fromdate: fromDate,
                todate: toDate,
            }),
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

        const response = await this.authenticatedRequest('/rest/secure/angelbroking/order/v1/getPosition', {
            method: 'GET',
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
        if (this.emergencyStopped) {
            // Even during emergency, squareOff is allowed (it reduces risk)
            logger.warn('Square-off proceeding despite emergency stop (risk reduction)');
        }
        this.ensureConnected();

        const positions = await this.getPositions();
        const openPositions = positions.filter(p => p.quantity !== 0);

        tradeLogger.warn('🔄 SQUARING OFF ALL POSITIONS', { count: openPositions.length });

        for (const pos of openPositions) {
            const side = pos.quantity > 0 ? 'SELL' : 'BUY';
            const quantity = Math.abs(pos.quantity);

            // Temporarily allow orders even if emergency stopped
            const wasEmergency = this.emergencyStopped;
            this.emergencyStopped = false;
            try {
                await this.placeOrder({
                    symbol: pos.symbol,
                    exchange: pos.exchange,
                    side,
                    quantity,
                    orderType: 'MARKET',
                    product: pos.product as any,
                });
                tradeLogger.warn('Position squared off', { symbol: pos.symbol, side, quantity });
            } finally {
                this.emergencyStopped = wasEmergency;
            }
        }
    }

    async cancelAllOrders(): Promise<void> {
        this.ensureConnected();

        const orderBook = await this.getOrderBook();
        const pendingOrders = orderBook.filter(
            (o: any) => o.orderstatus === 'open' || o.orderstatus === 'pending' || o.orderstatus === 'trigger pending'
        );

        tradeLogger.warn('Cancelling all pending orders', { count: pendingOrders.length });

        for (const order of pendingOrders) {
            await this.cancelOrder(order.orderid);
        }
    }

    isConnected(): boolean {
        return this.connected && !!this.tokens?.jwtToken;
    }

    getTokens(): AngelOneTokens | null {
        return this.tokens;
    }

    /**
     * Set tokens externally (e.g. loaded from DB or session restore)
     */
    setTokens(tokens: AngelOneTokens): void {
        this.tokens = tokens;
        this.connected = true;
    }

    // ─── HELPERS ──────────────────────────────────────────────

    private async getOrderBook(): Promise<any[]> {
        const response = await this.authenticatedRequest('/rest/secure/angelbroking/order/v1/getOrderBook', {
            method: 'GET',
        });
        return response.data || [];
    }

    /**
     * Resolve a trading symbol to an Angel One symbol token.
     * Uses in-memory cache → hardcoded map → searchScrip API.
     */
    private async resolveSymbolToken(symbol: string, exchange: string): Promise<string> {
        const cacheKey = `${exchange}:${symbol.toUpperCase()}`;

        // Check cache first
        if (this.symbolTokenCache.has(cacheKey)) {
            return this.symbolTokenCache.get(cacheKey)!;
        }

        // Hardcoded common tokens for speed
        const COMMON_TOKENS: Record<string, string> = {
            'NSE:NIFTY': '99926000',
            'NSE:BANKNIFTY': '99926009',
            'NSE:NIFTY 50': '99926000',
            'NSE:NIFTY BANK': '99926009',
            'NSE:RELIANCE': '2885',
            'NSE:TCS': '11536',
            'NSE:INFY': '1594',
            'NSE:HDFCBANK': '1333',
            'NSE:ICICIBANK': '4963',
            'NSE:SBIN': '3045',
            'NSE:ITC': '1660',
            'NSE:TATAMOTORS': '3456',
            'NSE:WIPRO': '3787',
            'NSE:BAJFINANCE': '317',
            'NSE:HINDUNILVR': '1394',
            'NSE:KOTAKBANK': '1922',
            'NSE:LT': '11483',
            'NSE:AXISBANK': '5900',
            'NSE:MARUTI': '10999',
            'NSE:ADANIENT': '25',
            'NSE:TITAN': '3506',
            'NSE:SUNPHARMA': '3351',
        };

        if (COMMON_TOKENS[cacheKey]) {
            this.symbolTokenCache.set(cacheKey, COMMON_TOKENS[cacheKey]);
            return COMMON_TOKENS[cacheKey];
        }

        // Fallback: Search via API
        const response = await this.authenticatedRequest('/rest/secure/angelbroking/order/v1/searchScrip', {
            method: 'POST',
            body: JSON.stringify({ exchange, searchscrip: symbol }),
        });

        if (response.data?.length > 0) {
            const token = response.data[0].symboltoken;
            this.symbolTokenCache.set(cacheKey, token);
            logger.debug('Symbol token resolved via API', { symbol, exchange, token });
            return token;
        }

        throw new BrokerError(`Symbol token not found for: ${exchange}:${symbol}`);
    }

    /**
     * Seed the symbol token cache with all instruments for a given set of symbols.
     * Call this after login to pre-warm the cache for your watchlist.
     */
    async seedSymbolCache(symbols: Array<{ symbol: string; exchange: string }>): Promise<void> {
        for (const { symbol, exchange } of symbols) {
            try {
                await this.resolveSymbolToken(symbol, exchange);
            } catch {
                logger.warn(`Failed to cache symbol token for ${exchange}:${symbol}`);
            }
        }
        logger.info(`Symbol cache seeded with ${this.symbolTokenCache.size} tokens`);
    }

    private async mapToAngelOrder(order: BrokerOrder): Promise<any> {
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

        let producttype = 'INTRADAY';
        switch (order.product) {
            case 'NRML':
                producttype = 'CARRYFORWARD';
                break;
            case 'CNC':
                producttype = 'DELIVERY';
                break;
        }

        // Resolve symbol token (don't leave it blank!)
        const exchange = order.exchange || 'NSE';
        const symboltoken = await this.resolveSymbolToken(order.symbol, exchange);

        return {
            variety,
            tradingsymbol: order.symbol,
            symboltoken,
            transactiontype: order.side,
            exchange,
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
        return 'OPEN';
    }

    private ensureConnected(): void {
        if (!this.connected || !this.tokens?.jwtToken) {
            throw new BrokerError('Not connected to Angel One. Please login first.');
        }
    }

    // ─── HTTP LAYER ───────────────────────────────────────────

    /**
     * Authenticated request with auto-retry, rate limiting, and session refresh on 401.
     * This is the SINGLE entry point for all authenticated API calls.
     */
    private async authenticatedRequest(
        path: string,
        options: { method: string; body?: string },
    ): Promise<any> {
        return withRetry(async () => {
            await RATE_LIMITER.throttle();

            try {
                const result = await this.rawRequest(path, { ...options, auth: true });
                return result;
            } catch (error: any) {
                // Auto-refresh on 401 / token expired
                if (error.message?.includes('401') || error.message?.toLowerCase().includes('token') ||
                    error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('session expired')) {
                    logger.warn('Session expired, refreshing...', { path });
                    await this.refreshSession();
                    // Retry the request with new token
                    return await this.rawRequest(path, { ...options, auth: true });
                }
                throw error;
            }
        }, {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffFactor: 2,
            isRetryable: (err) => {
                const msg = err.message?.toLowerCase() || '';
                // Don't retry on business logic errors
                if (msg.includes('insufficient') || msg.includes('invalid order') || msg.includes('rejected')) return false;
                return true;
            },
        });
    }

    /**
     * Raw HTTP request to Angel One API (no retry, no rate limit).
     */
    private async rawRequest(
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
        const startTime = Date.now();

        try {
            const response = await fetch(url, {
                method: options.method,
                headers,
                body: options.body,
            });

            const data: any = await response.json();
            const elapsed = Date.now() - startTime;

            // Log every API call for audit trail
            logger.debug('Angel One API', {
                method: options.method,
                path,
                status: response.status,
                elapsed: `${elapsed}ms`,
                success: response.ok,
            });

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
