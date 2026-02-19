// ============================================================
// EXECUTION ENGINE — The brain of the algo trading system
// ============================================================
// Connects: Market Data → Strategy Evaluation → Order Execution
//
// Flow:
// 1. MarketDataService emits 'candle_close' events
// 2. Engine looks up all RUNNING strategies for that symbol
// 3. Evaluates each strategy against recent candles
// 4. If signal = BUY/SELL → runs risk checks → places order
// 5. Emits events for WebSocket (real-time UI updates)
// ============================================================

import { EventEmitter } from 'events';
import prisma from '../config/database';
import { env } from '../config/env';
import logger from '../utils/logger';
import { marketDataService, TickData } from '../services/marketDataService';
import { OrderExecutor } from './orderExecutor';
import { getBrokerInstance } from './brokerFactory';
import { strategyRegistry } from '../strategies';
import { Signal, StrategyConfig, StrategyResult } from '../strategies/base';
import { CandleInput } from '../strategies/indicators';

export interface EngineStatus {
    running: boolean;
    mode: string;
    activeStrategies: number;
    totalSignals: number;
    totalOrders: number;
    startedAt: Date | null;
    uptime: number; // seconds
}

interface RunningStrategy {
    id: string;
    userId: string;
    name: string;
    strategyType: string;
    symbol: string;
    exchange: string;
    config: StrategyConfig;
    todayTradeCount: number;
    lastSignal: Signal;
    lastEvaluation: Date | null;
}

export class ExecutionEngine extends EventEmitter {
    private running = false;
    private startedAt: Date | null = null;
    private orderExecutor: OrderExecutor | null = null;
    private activeStrategies = new Map<string, RunningStrategy>();
    private totalSignals = 0;
    private totalOrders = 0;
    private emergencyStopped = false;

    /**
     * Start the execution engine — subscribes to market data,
     * loads active strategies, begins auto-trading loop.
     */
    async start(): Promise<void> {
        if (this.running) {
            logger.warn('Engine already running');
            return;
        }

        logger.info('═══ EXECUTION ENGINE STARTING ═══');

        // 1. Create order executor with current broker
        const broker = getBrokerInstance();
        this.orderExecutor = new OrderExecutor(broker);

        // 2. Load all RUNNING strategies from DB
        await this.loadActiveStrategies();

        // 3. Subscribe to market data events
        marketDataService.on('candle_close', this.onCandleClose.bind(this));
        marketDataService.on('tick', this.onTick.bind(this));

        this.running = true;
        this.emergencyStopped = false;
        this.startedAt = new Date();

        // 4. Ensure market data is running for all strategy symbols
        const symbols = [...new Set(Array.from(this.activeStrategies.values()).map((s) => s.symbol))];
        if (symbols.length > 0) {
            marketDataService.start(symbols);
        }

        logger.info(`Engine started — ${this.activeStrategies.size} strategies active, mode: ${env.TRADING_MODE}`);
        this.emit('engine_started', { strategies: this.activeStrategies.size, mode: env.TRADING_MODE });
    }

    /**
     * Stop the engine gracefully.
     */
    async stop(): Promise<void> {
        if (!this.running) return;

        logger.info('═══ EXECUTION ENGINE STOPPING ═══');

        // Remove event listeners
        marketDataService.removeAllListeners('candle_close');
        marketDataService.removeAllListeners('tick');

        // Update all running strategies to STOPPED in DB
        for (const [id] of this.activeStrategies) {
            await prisma.strategy.update({
                where: { id },
                data: { status: 'STOPPED' },
            }).catch(() => { /* ignore if already updated */ });
        }

        this.activeStrategies.clear();
        this.running = false;
        this.startedAt = null;

        logger.info('Engine stopped');
        this.emit('engine_stopped');
    }

    /**
     * Emergency stop — immediately cancels all orders, squares off positions.
     */
    async emergencyStop(userId?: string): Promise<{ cancelledOrders: number; squaredOff: boolean }> {
        logger.warn('!!! EMERGENCY STOP TRIGGERED !!!');
        this.emergencyStopped = true;

        const broker = getBrokerInstance();
        let cancelledOrders = 0;
        let squaredOff = false;

        try {
            // Cancel all open orders
            await broker.cancelAllOrders();
            cancelledOrders = await prisma.order.updateMany({
                where: { status: 'PLACED', ...(userId ? { userId } : {}) },
                data: { status: 'CANCELLED' },
            }).then(r => r.count);

            // Square off all positions
            await broker.squareOffAll();
            squaredOff = true;

            // Mark all positions as closed
            await prisma.position.updateMany({
                where: { status: 'OPEN', ...(userId ? { userId } : {}) },
                data: { status: 'CLOSED', closedAt: new Date() },
            });
        } catch (error: any) {
            logger.error(`Emergency stop error: ${error.message}`);
        }

        // Stop the engine
        await this.stop();

        this.emit('emergency_stop', { cancelledOrders, squaredOff });
        return { cancelledOrders, squaredOff };
    }

    /**
     * Load/reload active strategies from database.
     */
    async loadActiveStrategies(): Promise<void> {
        const strategies = await prisma.strategy.findMany({
            where: { status: 'RUNNING', isActive: true },
        });

        this.activeStrategies.clear();

        for (const s of strategies) {
            const params = JSON.parse(s.parameters || '{}');

            this.activeStrategies.set(s.id, {
                id: s.id,
                userId: s.userId,
                name: s.name,
                strategyType: s.strategyType,
                symbol: s.symbol,
                exchange: s.exchange,
                config: {
                    symbol: s.symbol,
                    quantity: s.quantity,
                    parameters: params,
                    stopLossPercent: s.stopLossPercent ?? undefined,
                    takeProfitPercent: s.takeProfitPercent ?? undefined,
                    maxTradesPerDay: s.maxTradesPerDay,
                },
                todayTradeCount: 0,
                lastSignal: Signal.HOLD,
                lastEvaluation: null,
            });
        }

        logger.info(`Loaded ${this.activeStrategies.size} active strategies`);
    }

    /**
     * Add a strategy to the running engine (called when user starts a strategy).
     */
    async addStrategy(strategyId: string): Promise<void> {
        const s = await prisma.strategy.findUnique({ where: { id: strategyId } });
        if (!s) throw new Error(`Strategy ${strategyId} not found`);

        const params = JSON.parse(s.parameters || '{}');

        this.activeStrategies.set(s.id, {
            id: s.id,
            userId: s.userId,
            name: s.name,
            strategyType: s.strategyType,
            symbol: s.symbol,
            exchange: s.exchange,
            config: {
                symbol: s.symbol,
                quantity: s.quantity,
                parameters: params,
                stopLossPercent: s.stopLossPercent ?? undefined,
                takeProfitPercent: s.takeProfitPercent ?? undefined,
                maxTradesPerDay: s.maxTradesPerDay,
            },
            todayTradeCount: 0,
            lastSignal: Signal.HOLD,
            lastEvaluation: null,
        });

        // Ensure market data covers this symbol
        marketDataService.start([s.symbol]);

        // Update status in DB
        await prisma.strategy.update({
            where: { id: strategyId },
            data: { status: 'RUNNING' },
        });

        logger.info(`Strategy added to engine: ${s.name} (${s.symbol})`);
        this.emit('strategy_added', { id: s.id, name: s.name, symbol: s.symbol });
    }

    /**
     * Remove a strategy from the running engine.
     */
    async removeStrategy(strategyId: string): Promise<void> {
        const strategy = this.activeStrategies.get(strategyId);
        if (!strategy) return;

        this.activeStrategies.delete(strategyId);

        await prisma.strategy.update({
            where: { id: strategyId },
            data: { status: 'STOPPED' },
        }).catch(() => { });

        logger.info(`Strategy removed from engine: ${strategy.name}`);
        this.emit('strategy_removed', { id: strategyId, name: strategy.name });
    }

    /**
     * Get current engine status.
     */
    getStatus(): EngineStatus {
        return {
            running: this.running,
            mode: env.TRADING_MODE,
            activeStrategies: this.activeStrategies.size,
            totalSignals: this.totalSignals,
            totalOrders: this.totalOrders,
            startedAt: this.startedAt,
            uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
        };
    }

    // ─── EVENT HANDLERS ─────────────────────────────────────

    /**
     * Called on every candle close — evaluate all matching strategies.
     */
    private async onCandleClose(event: { symbol: string; timeframe: string; candle: CandleInput }) {
        if (!this.running || this.emergencyStopped) return;

        const { symbol, timeframe, candle } = event;

        // Find all strategies watching this symbol
        for (const [id, strategy] of this.activeStrategies) {
            if (strategy.symbol !== symbol) continue;

            try {
                await this.evaluateStrategy(strategy, symbol);
            } catch (error: any) {
                logger.error(`Strategy evaluation error [${strategy.name}]: ${error.message}`);
                this.emit('strategy_error', { strategyId: id, error: error.message });
            }
        }
    }

    /**
     * Called on every tick — used for real-time P&L + SL/TP monitoring.
     */
    private onTick(tick: TickData) {
        if (!this.running) return;
        // Emit for WebSocket broadcast
        this.emit('tick', tick);
    }

    /**
     * Core strategy evaluation logic.
     */
    private async evaluateStrategy(strategy: RunningStrategy, symbol: string) {
        // 1. Check trading hours
        if (!this.isWithinTradingHours()) {
            return;
        }

        // 2. Check daily trade limit
        if (strategy.config.maxTradesPerDay && strategy.todayTradeCount >= strategy.config.maxTradesPerDay) {
            return;
        }

        // 3. Get strategy implementation from registry
        const impl = strategyRegistry.get(strategy.strategyType);
        if (!impl) {
            logger.warn(`Unknown strategy type: ${strategy.strategyType}`);
            return;
        }

        // 4. Get recent candles
        const candles = await marketDataService.getCandles(symbol, 'ONE_MINUTE', impl.requiredBars + 10);
        if (candles.length < impl.requiredBars) {
            logger.debug(`Not enough candles for ${strategy.name}: ${candles.length}/${impl.requiredBars}`);
            return;
        }

        // 5. Check if there's an open position for this strategy
        const openPosition = await prisma.position.findFirst({
            where: { strategyId: strategy.id, status: 'OPEN' },
        });

        // 6. Evaluate strategy
        const result: StrategyResult = impl.evaluate(candles, strategy.config, !!openPosition);
        this.totalSignals++;
        strategy.lastSignal = result.signal;
        strategy.lastEvaluation = new Date();

        // Emit for logging/UI
        this.emit('signal', {
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol,
            signal: result.signal,
            confidence: result.confidence,
            reason: result.reason,
            indicators: result.indicators,
        });

        // 7. Act on signal
        if (result.signal === Signal.HOLD) return;
        if (result.confidence < 0.5) {
            logger.debug(`Signal ${result.signal} rejected — low confidence: ${result.confidence}`);
            return;
        }

        // Don't open another position if we already have one (same direction)
        if (openPosition) {
            if (result.signal === Signal.BUY && openPosition.side === 'LONG') return;
            if (result.signal === Signal.SELL && openPosition.side === 'SHORT') return;
        }

        // 8. Risk check
        const riskState = await prisma.riskState.findUnique({
            where: { userId: strategy.userId },
        });
        if (riskState?.isLocked) {
            logger.warn(`Risk locked for user ${strategy.userId}: ${riskState.lockReason}`);
            return;
        }

        // 9. Place order
        logger.info(`📊 SIGNAL: ${result.signal} ${symbol} | Strategy: ${strategy.name} | Confidence: ${(result.confidence * 100).toFixed(1)}% | Reason: ${result.reason}`);

        try {
            const order = await this.orderExecutor!.executeOrder({
                userId: strategy.userId,
                strategyId: strategy.id,
                symbol: strategy.symbol,
                exchange: strategy.exchange,
                side: result.signal === Signal.BUY ? 'BUY' : 'SELL',
                quantity: strategy.config.quantity,
                orderType: 'MARKET',
            });

            this.totalOrders++;
            strategy.todayTradeCount++;

            this.emit('order_placed', {
                strategyId: strategy.id,
                strategyName: strategy.name,
                orderId: order.id,
                symbol,
                side: result.signal,
                quantity: strategy.config.quantity,
            });

            logger.info(`✅ Order placed: ${order.id} | ${result.signal} ${strategy.config.quantity}x ${symbol}`);
        } catch (error: any) {
            logger.error(`❌ Order failed: ${error.message}`);
            this.emit('order_error', { strategyId: strategy.id, error: error.message });
        }
    }

    /**
     * Check if current time is within IST trading hours (9:15 - 15:30).
     */
    private isWithinTradingHours(): boolean {
        // In paper mode, always allow trading for testing
        if (env.TRADING_MODE === 'paper') return true;

        const now = new Date();
        // Convert to IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

        const hours = ist.getHours();
        const minutes = ist.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        const marketOpen = 9 * 60 + 15;  // 9:15 AM
        const marketClose = 15 * 60 + 30; // 3:30 PM

        return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
    }
}

// Singleton
export const executionEngine = new ExecutionEngine();
