// ============================================================
// MARKET DATA SERVICE — WebSocket ticks + candle aggregation
// ============================================================
// Architecture:
// - Connects to Zerodha WebSocket for live ticks
// - Falls back to simulated data in paper mode
// - Aggregates ticks into OHLCV candles
// - Emits candle-close events for strategy evaluation
// - Auto-reconnection with exponential backoff
// ============================================================

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import prisma from '../config/database';
import { env } from '../config/env';
import logger from '../utils/logger';
import { CandleInput } from '../strategies/indicators';
import { getBrokerInstance } from '../engine/brokerFactory';

export interface TickData {
    symbol: string;
    exchange: string;
    lastPrice: number;
    volume: number;
    timestamp: Date;
}

interface CandleBuilder {
    symbol: string;
    timeframe: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    startTime: Date;
}

export class MarketDataService extends EventEmitter {
    private ws: WebSocket | null = null;
    private candleBuilders = new Map<string, CandleBuilder>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private simulationTimer: NodeJS.Timeout | null = null;
    private candleCloseTimer: NodeJS.Timeout | null = null;
    private subscribedSymbols = new Set<string>();
    private running = false;

    // Public tick cache
    private latestPrices = new Map<string, number>();

    /**
     * Start market data feed
     */
    start(symbols: string[]) {
        if (this.running) return;
        this.running = true;
        symbols.forEach((s) => this.subscribedSymbols.add(s));

        if (env.TRADING_MODE === 'live' && env.KITE_ACCESS_TOKEN) {
            this.connectWebSocket();
        } else if (env.TRADING_MODE === 'live') {
            // Angel One live pricing via LTP polling
            this.startAngelOneLiveData();
        } else {
            this.startSimulation();
        }

        logger.info(`Market data started for: ${symbols.join(', ')}`);
    }

    /**
     * Stop all feeds
     */
    stop() {
        this.running = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.simulationTimer) {
            clearInterval(this.simulationTimer);
            this.simulationTimer = null;
        }
        if (this.candleCloseTimer) {
            clearInterval(this.candleCloseTimer);
            this.candleCloseTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        logger.info('Market data stopped');
    }

    /**
     * Get latest price for a symbol
     */
    getLatestPrice(symbol: string): number | undefined {
        return this.latestPrices.get(symbol);
    }

    /**
     * Get recent candles from DB
     */
    async getCandles(symbol: string, timeframe: string, limit = 100): Promise<CandleInput[]> {
        const candles = await prisma.candle.findMany({
            where: { symbol, timeframe: timeframe as any },
            orderBy: { timestamp: 'asc' },
            take: limit,
        });

        return candles.map((c: any) => ({
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            timestamp: c.timestamp,
        }));
    }

    // ─── ZERODHA WEBSOCKET ────────────────────────────────────

    private connectWebSocket() {
        try {
            const url = `wss://ws.kite.trade?api_key=${env.KITE_API_KEY}&access_token=${env.KITE_ACCESS_TOKEN}`;
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                logger.info('Zerodha WebSocket connected');
                this.reconnectAttempts = 0;

                // Subscribe to instruments
                const instrumentTokens = this.getInstrumentTokens();
                if (this.ws && instrumentTokens.length > 0) {
                    this.ws.send(
                        JSON.stringify({
                            a: 'subscribe',
                            v: instrumentTokens,
                        })
                    );
                    this.ws.send(
                        JSON.stringify({
                            a: 'mode',
                            v: ['full', instrumentTokens],
                        })
                    );
                }
            });

            this.ws.on('message', (data: Buffer) => {
                this.processTickData(data);
            });

            this.ws.on('close', (code, reason) => {
                logger.warn(`WebSocket closed: ${code} ${reason}`);
                this.scheduleReconnect();
            });

            this.ws.on('error', (error) => {
                logger.error(`WebSocket error: ${error.message}`);
            });
        } catch (error: any) {
            logger.error(`WebSocket connection failed: ${error.message}`);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (!this.running || this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached. Stopping market data.');
            this.emit('disconnected');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
    }

    private processTickData(data: Buffer) {
        // Kite sends binary tick data — simplified parsing
        // In production, use the official kiteconnect-ts library
        // For now, this handles the basic format
        try {
            // Parse binary packet (simplified)
            // Real implementation would parse the binary protocol:
            // https://kite.trade/docs/connect/v3/websocket/
            this.emit('raw_tick', data);
        } catch (error: any) {
            logger.error(`Tick parse error: ${error.message}`);
        }
    }

    private getInstrumentTokens(): number[] {
        // Map symbols to instrument tokens
        // In production, load from Zerodha instruments dump
        const tokenMap: Record<string, number> = {
            NIFTY: 256265,
            BANKNIFTY: 260105,
            RELIANCE: 738561,
            TCS: 2953217,
            INFY: 408065,
            HDFCBANK: 341249,
        };

        return Array.from(this.subscribedSymbols)
            .map((s) => tokenMap[s.toUpperCase()])
            .filter(Boolean);
    }

    // ─── ANGEL ONE LIVE DATA (Production) ────────────────────

    /**
     * Poll Angel One LTP API every 5 seconds for real prices.
     * This replaces the Zerodha WebSocket when Angel One is the active broker.
     */
    private startAngelOneLiveData() {
        // Seed realistic base prices (used until first successful poll)
        const basePrices: Record<string, number> = {
            NIFTY: 22450, BANKNIFTY: 48200, RELIANCE: 2480,
            TCS: 3920, INFY: 1570, HDFCBANK: 1640, ICICIBANK: 1060,
        };
        this.subscribedSymbols.forEach((s) => {
            if (!this.latestPrices.has(s)) this.latestPrices.set(s, basePrices[s] || 1000);
        });

        // Poll live prices every 5 seconds (well within Angel One rate limit)
        this.simulationTimer = setInterval(async () => {
            if (!this.running) return;
            const broker = getBrokerInstance();
            if (!broker.isConnected()) {
                logger.debug('Broker not connected — skipping live price poll');
                return;
            }
            for (const symbol of this.subscribedSymbols) {
                try {
                    const price = await broker.getCurrentPrice(symbol, 'NSE');
                    const tick: TickData = {
                        symbol,
                        exchange: 'NSE',
                        lastPrice: price,
                        volume: 0,
                        timestamp: new Date(),
                    };
                    this.onTick(tick);
                } catch (err: any) {
                    // Non-fatal: just log and continue (stale price is used)
                    logger.debug(`Live price poll failed for ${symbol}: ${err.message}`);
                }
            }
        }, 5000);

        // Close 1-minute candles on exact minute boundaries
        this.candleCloseTimer = setInterval(() => this.closeMinuteCandles(), 60000);

        logger.info('Angel One live price polling started (5s interval)');
    }

    // ─── SIMULATION (Paper Trading) ───────────────────────────

    private startSimulation() {
        // Base prices for simulation
        const basePrices: Record<string, number> = {
            NIFTY: 21500,
            BANKNIFTY: 47200,
            RELIANCE: 2450,
            TCS: 3820,
            INFY: 1580,
            HDFCBANK: 1620,
            ICICIBANK: 1050,
        };

        // Initialize prices
        this.subscribedSymbols.forEach((symbol) => {
            this.latestPrices.set(symbol, basePrices[symbol] || 1000);
        });

        // Generate ticks every 2 seconds
        this.simulationTimer = setInterval(() => {
            this.subscribedSymbols.forEach((symbol) => {
                const currentPrice = this.latestPrices.get(symbol) || 1000;
                // Random walk: ±0.2%
                const change = currentPrice * (Math.random() - 0.5) * 0.004;
                const newPrice = Math.round((currentPrice + change) * 100) / 100;

                this.latestPrices.set(symbol, newPrice);

                const tick: TickData = {
                    symbol,
                    exchange: 'NSE',
                    lastPrice: newPrice,
                    volume: Math.floor(Math.random() * 10000) + 1000,
                    timestamp: new Date(),
                };

                this.onTick(tick);
            });
        }, 2000);

        // Close candles every minute
        this.candleCloseTimer = setInterval(() => this.closeMinuteCandles(), 60000);

        logger.info('Market data simulation started');
    }

    /**
     * Process incoming tick — update price cache + build candle
     */
    onTick(tick: TickData) {
        this.latestPrices.set(tick.symbol, tick.lastPrice);

        // Update candle builder
        const key = `${tick.symbol}:1m`;
        let builder = this.candleBuilders.get(key);

        if (!builder) {
            builder = {
                symbol: tick.symbol,
                timeframe: 'ONE_MINUTE',
                open: tick.lastPrice,
                high: tick.lastPrice,
                low: tick.lastPrice,
                close: tick.lastPrice,
                volume: Number(tick.volume),
                startTime: new Date(),
            };
            this.candleBuilders.set(key, builder);
        } else {
            builder.high = Math.max(builder.high, tick.lastPrice);
            builder.low = Math.min(builder.low, tick.lastPrice);
            builder.close = tick.lastPrice;
            builder.volume += Number(tick.volume);
        }

        // Emit tick event for real-time UI updates
        this.emit('tick', tick);
    }

    /**
     * Close all minute candles and persist to DB
     */
    private async closeMinuteCandles() {
        for (const [key, builder] of this.candleBuilders) {
            const candle: CandleInput = {
                open: builder.open,
                high: builder.high,
                low: builder.low,
                close: builder.close,
                volume: Math.floor(builder.volume),
                timestamp: builder.startTime,
            };

            // Persist to DB
            try {
                await prisma.candle.create({
                    data: {
                        symbol: builder.symbol,
                        timeframe: 'ONE_MINUTE',
                        timestamp: builder.startTime,
                        open: builder.open,
                        high: builder.high,
                        low: builder.low,
                        close: builder.close,
                        volume: Math.floor(builder.volume),
                    },
                });
            } catch (error: any) {
                // Ignore duplicate key errors
                if (!error.message?.includes('Unique constraint')) {
                    logger.error(`Failed to persist candle: ${error.message}`);
                }
            }

            // Emit candle close event — this triggers strategy evaluation
            this.emit('candle_close', {
                symbol: builder.symbol,
                timeframe: 'ONE_MINUTE',
                candle,
            });

            // Reset builder for next candle
            const price = builder.close;
            this.candleBuilders.set(key, {
                symbol: builder.symbol,
                timeframe: 'ONE_MINUTE',
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0,
                startTime: new Date(),
            });
        }
    }
}

export const marketDataService = new MarketDataService();
