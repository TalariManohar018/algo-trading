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
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { env } from '../config/env';
import logger from '../utils/logger';
import { marketDataService, TickData } from '../services/marketDataService';
import { candleAggregator } from '../services/candleAggregator';
import { OrderExecutor } from './orderExecutor';
import { getBrokerInstance } from './brokerFactory';
import { riskManagementService } from '../services/riskService';
import { strategyRegistry } from '../strategies';
import { Signal, StrategyConfig, StrategyResult } from '../strategies/base';
import { CandleInput } from '../strategies/indicators';
import { executionQueue } from './executionQueue';
import { conflictResolver } from './conflictResolver';
import { slippageModel } from './slippageModel';
import { mtmEngine } from './mtmEngine';
import { orderReconciliationService } from './orderReconciliation';

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
    debug: boolean;
}

export class ExecutionEngine extends EventEmitter {
    private running = false;
    private startedAt: Date | null = null;
    private orderExecutor: OrderExecutor | null = null;
    private activeStrategies = new Map<string, RunningStrategy>();
    private totalSignals = 0;
    private totalOrders = 0;
    private emergencyStopped = false;
    // Track positions with in-flight close orders (prevents duplicate SL/TP closes)
    private closingPositionIds = new Set<string>();
    // Track per-strategy signal timestamps for latency/slippage measurement
    private signalTimestamps = new Map<string, Date>();

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

        // 1. Run pre-trading validation
        const broker = getBrokerInstance();
        if (env.TRADING_MODE === 'live') {
            if (!broker.isConnected()) {
                logger.error('❌ LIVE MODE: Broker not connected — engine start aborted');
                throw new Error('Broker not connected. Engine cannot start in live mode.');
            }
            const validation = await riskManagementService.validatePreTrading('dev-user-001');
            for (const check of validation.checks) {
                const icon = check.passed ? '✅' : '❌';
                logger.info(`  ${icon} ${check.name}: ${check.message}`);
            }
            if (!validation.ok) {
                const blocked = validation.checks.filter(c => !c.passed).map(c => c.name).join(', ');
                logger.error(`❌ Pre-trading validation FAILED — blocked by: ${blocked}`);
                // Do not throw — allow engine start during off-hours so cron can activate it
            }
        }

        // 2. Create order executor with current broker
        this.orderExecutor = new OrderExecutor(broker);

        // 3. Load all RUNNING strategies from DB
        await this.loadActiveStrategies();

        // 4. Subscribe to market data events
        marketDataService.on('candle_close', this.onCandleClose.bind(this));
        marketDataService.on('tick', this.onTick.bind(this));
        // Also forward candle closes from multi-TF aggregator
        candleAggregator.on('candle_close', this.onCandleClose.bind(this));

        // 5. Wire execution queue handler
        executionQueue.setHandler(async (queuedOrder) => {
            if (!this.orderExecutor) throw new Error('No order executor');
            await this.orderExecutor.executeOrder({
                userId: queuedOrder.userId,
                strategyId: queuedOrder.strategyId,
                symbol: queuedOrder.symbol,
                exchange: queuedOrder.exchange,
                side: queuedOrder.side,
                quantity: queuedOrder.quantity,
                orderType: queuedOrder.orderType,
                limitPrice: queuedOrder.limitPrice,
                triggerPrice: queuedOrder.triggerPrice,
                stopLoss: queuedOrder.stopLoss,
                takeProfit: queuedOrder.takeProfit,
            });
        });

        // 6. Start MTM engine
        mtmEngine.start(env.MAX_TRADE_SIZE, 'dev-user-001');
        mtmEngine.on('portfolio_snapshot', (snap) => this.emit('portfolio_snapshot', snap));

        // 7. Start order reconciliation (only in live mode)
        if (env.TRADING_MODE === 'live') {
            orderReconciliationService.start(broker);
            orderReconciliationService.on('order_filled', (ev) => this.emit('order_filled', ev));
            orderReconciliationService.on('partial_fill', (ev) => this.emit('partial_fill', ev));
            orderReconciliationService.on('order_rejected', (ev) => this.emit('order_rejected', ev));
        }

        this.running = true;
        this.emergencyStopped = false;
        this.startedAt = new Date();

        // 8. Ensure market data is running for all strategy symbols
        const strategySymbols = [...new Set(Array.from(this.activeStrategies.values()).map((s) => s.symbol))];
        const baseSymbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
        const allSymbols = [...new Set([...baseSymbols, ...strategySymbols])];
        marketDataService.start(allSymbols);

        logger.info(`Engine started — ${this.activeStrategies.size} strategies active, mode: ${env.TRADING_MODE}`);
        logger.info(`Market data subscribed for: ${allSymbols.join(', ')}`);
        logger.info(`Production services: ExecutionQueue ✓ | MTM ✓ | Reconciliation ${env.TRADING_MODE === 'live' ? '✓' : 'paper-skipped'} | CandleAggregator ✓`);
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
        candleAggregator.removeAllListeners('candle_close');

        // Drain execution queue
        executionQueue.drainUser('dev-user-001');

        // Stop MTM and reconciliation
        mtmEngine.stop();
        orderReconciliationService.stop();

        // Update all running strategies to PAUSED (EOD auto-stop, restored at 9 AM)
        for (const [id] of this.activeStrategies) {
            await prisma.strategy.update({
                where: { id },
                data: { status: 'PAUSED' },
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
                    parameters: { ...params, _strategyName: s.name },
                    stopLossPercent: s.stopLossPercent ?? undefined,
                    takeProfitPercent: s.takeProfitPercent ?? undefined,
                    maxTradesPerDay: s.maxTradesPerDay,
                },
                todayTradeCount: 0,
                lastSignal: Signal.HOLD,
                lastEvaluation: null,
                debug: params.debug === true,
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
                parameters: { ...params, _strategyName: s.name },
                stopLossPercent: s.stopLossPercent ?? undefined,
                takeProfitPercent: s.takeProfitPercent ?? undefined,
                maxTradesPerDay: s.maxTradesPerDay,
            },
            todayTradeCount: 0,
            lastSignal: Signal.HOLD,
            lastEvaluation: null,
            debug: params.debug === true,
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
     * Only processes 1-minute candles for strategy evaluation (5m/15m use aggregated data).
     */
    private async onCandleClose(event: { symbol: string; timeframe: string; candle: CandleInput }) {
        if (!this.running || this.emergencyStopped) return;

        const { symbol, timeframe, candle } = event;

        // Only trigger strategy evaluation on 1-minute candles to avoid redundant signals.
        // Strategies needing 5m/15m data will call candleAggregator.getCandles() internally.
        if (timeframe !== 'ONE_MINUTE') return;

        // Clear per-candle dedup gates — allow fresh signals this candle
        executionQueue.clearDedupForNewCandle();
        conflictResolver.clearCandleSignals();

        // Find all strategies watching this symbol
        for (const [id, strategy] of this.activeStrategies) {
            if (strategy.symbol !== symbol) continue;

            // Record signal timestamp for latency tracking
            this.signalTimestamps.set(strategy.id, new Date());

            try {
                await this.evaluateStrategy(strategy, symbol);
            } catch (error: any) {
                logger.error(`Strategy evaluation error [${strategy.name}]: ${error.message}`);
                // LIVE_SAFE_MODE: halt strategy immediately on any uncaught evaluation error.
                // Prevents a broken strategy from looping and placing bad orders.
                if (env.LIVE_SAFE_MODE) {
                    logger.warn(`🔒 LIVE_SAFE_MODE: auto-halting strategy "${strategy.name}" — manual restart required`);
                    this.activeStrategies.delete(id);
                    await prisma.strategy.update({ where: { id }, data: { status: 'ERROR' } }).catch(() => { });
                    await prisma.auditLog.create({
                        data: {
                            userId: strategy.userId,
                            event: 'STRATEGY_ERROR',
                            severity: 'CRITICAL',
                            message: `LIVE_SAFE_MODE: strategy "${strategy.name}" auto-halted — ${error.message}`,
                        },
                    }).catch(() => { });
                }
                this.emit('strategy_error', { strategyId: id, error: error.message });
            }
        }
    }

    /**
     * Called on every tick — real-time P&L broadcast + SL/TP auto-close + MTM.
     */
    private async onTick(tick: TickData) {
        if (!this.running || this.emergencyStopped) return;
        // Broadcast to WebSocket clients
        this.emit('tick', tick);
        // Update MTM for all open positions on this symbol
        mtmEngine.onTick(tick.symbol, tick.lastPrice);
        // Feed tick into multi-TF candle aggregator
        candleAggregator.processTick({
            symbol: tick.symbol,
            exchange: tick.exchange,
            lastPrice: tick.lastPrice,
            volume: tick.volume,
            timestamp: tick.timestamp,
        });
        // Check open positions for SL/TP triggers
        await this.monitorPositionsForSlTp(tick);
    }

    /**
     * For every tick, check all open positions on that symbol and auto-close
     * if the current price has crossed the stored stopLoss or takeProfit.
     */
    private async monitorPositionsForSlTp(tick: TickData) {
        const positions = await prisma.position.findMany({
            where: { symbol: tick.symbol, status: 'OPEN' },
        }) as Array<{
            id: string; userId: string; strategyId: string | null;
            symbol: string; exchange: string; side: string;
            quantity: number; entryPrice: number;
            stopLoss: number | null; takeProfit: number | null;
        }>;

        for (const pos of positions) {
            const price = tick.lastPrice;
            let trigger: 'SL' | 'TP' | null = null;

            if (pos.side === 'LONG') {
                if (pos.stopLoss && price <= pos.stopLoss) trigger = 'SL';
                else if (pos.takeProfit && price >= pos.takeProfit) trigger = 'TP';
            } else {
                if (pos.stopLoss && price >= pos.stopLoss) trigger = 'SL';
                else if (pos.takeProfit && price <= pos.takeProfit) trigger = 'TP';
            }

            if (!trigger || !this.orderExecutor) continue;

            // Prevent duplicate close orders (in-memory guard for same-tick duplicates)
            if (this.closingPositionIds.has(pos.id)) continue;
            this.closingPositionIds.add(pos.id);

            logger.warn(`🎯 ${trigger} TRIGGERED | ${pos.symbol} | Price: ₹${price} | ${trigger === 'SL' ? `SL: ₹${pos.stopLoss}` : `TP: ₹${pos.takeProfit}`}`);

            try {
                await this.orderExecutor.executeOrder({
                    userId: pos.userId,
                    strategyId: pos.strategyId ?? undefined,
                    symbol: pos.symbol,
                    exchange: pos.exchange,
                    side: pos.side === 'LONG' ? 'SELL' : 'BUY',
                    quantity: pos.quantity,
                    orderType: 'MARKET',
                });
                this.emit('sl_tp_triggered', { symbol: pos.symbol, trigger, price });
            } catch (err: any) {
                logger.error(`Auto ${trigger} close failed for ${pos.symbol}: ${err.message}`);
                this.closingPositionIds.delete(pos.id); // allow retry on next tick
            }
        }
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
        if (strategy.debug) {
            logger.info(`🔧 [ENGINE] Evaluating strategy: ${strategy.name} (${strategy.strategyType}) | Symbol: ${symbol} | Candles: ${candles.length} | Open position: ${!!openPosition}`);
        }
        const result: StrategyResult = impl.evaluate(candles, strategy.config, !!openPosition);
        this.totalSignals++;
        strategy.lastSignal = result.signal;
        strategy.lastEvaluation = new Date();

        if (strategy.debug && result.signal !== Signal.HOLD) {
            logger.info(`🔧 [ENGINE] Signal: ${result.signal} | Confidence: ${(result.confidence * 100).toFixed(1)}% | Reason: ${result.reason}`);
        }

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

        // 8. Risk check — all 10 rules via riskManagementService
        const lastCandle = candles[candles.length - 1];
        const entryPrice = lastCandle?.close || 0;
        const stopLossPercent = strategy.config.stopLossPercent || 0;
        const takeProfitPercent = strategy.config.takeProfitPercent || 0;

        // 8a. Require stop loss to be configured — HARD block
        if (stopLossPercent <= 0) {
            const rejReason = `Mandatory SL not set on "${strategy.name}" — set stopLossPercent > 0 to trade`;
            logger.warn(`❌ Order blocked for ${strategy.name}: stopLossPercent not set. Add a stop loss to trade.`);
            await riskManagementService.logRejectedTrade(strategy.userId, symbol, result.signal, rejReason);
            return;
        }

        // 8b. Calculate safe position size based on ₹100 max risk
        const safeQty = riskManagementService.calculatePositionSize(entryPrice, stopLossPercent);
        // Use `let` so LIVE_SAFE_MODE can cap it below
        let effectiveQty = Math.min(safeQty, strategy.config.quantity || 1);

        // LIVE_SAFE_MODE: hard cap quantity to 1 per order — smallest possible test size
        if (env.LIVE_SAFE_MODE) {
            effectiveQty = 1;
            logger.debug(`🔒 LIVE_SAFE_MODE: qty capped to 1 for ${strategy.name}`);
        }

        // 8c. Conflict resolution — prevent opposing signals across strategies
        slippageModel.recordSignalTime(strategy.id);
        const conflictDecision = await conflictResolver.resolve({
            strategyId: strategy.id,
            strategyName: strategy.name,
            userId: strategy.userId,
            symbol,
            side: result.signal === Signal.BUY ? 'BUY' : 'SELL',
            positionSide: result.signal === Signal.BUY ? 'LONG' : 'SHORT',
            quantity: effectiveQty,
            confidence: result.confidence,
            timestamp: new Date(),
        });
        if (!conflictDecision.allowed) {
            logger.info(`🔀 Conflict block [${strategy.name}]: ${conflictDecision.reason}`);
            await riskManagementService.logRejectedTrade(strategy.userId, symbol, result.signal, `CONFLICT: ${conflictDecision.reason}`);
            return;
        }
        if (conflictDecision.adjustedQuantity) effectiveQty = conflictDecision.adjustedQuantity;

        // 8d. Slippage check — reject if signal is stale or slippage too high
        const slippageEst = slippageModel.estimate(
            symbol,
            result.signal === Signal.BUY ? 'BUY' : 'SELL',
            entryPrice,
            effectiveQty,
            this.signalTimestamps.get(strategy.id)
        );
        if (!slippageEst.isViable) {
            logger.warn(`⚠️  Slippage block [${strategy.name}]: ${slippageEst.rejectReason ?? `${slippageEst.slippagePct}% slippage`}`);
            await riskManagementService.logRejectedTrade(strategy.userId, symbol, result.signal, `SLIPPAGE: ${slippageEst.rejectReason ?? slippageEst.slippagePct + '%'}`);
            return;
        }

        // 8e. Full pre-order risk check
        const estimatedValue = effectiveQty * entryPrice;
        const riskCheck = await riskManagementService.checkPreOrder(strategy.userId, estimatedValue, stopLossPercent);
        if (!riskCheck.allowed) {
            logger.warn(`⛔ Risk BLOCKED [${strategy.name}]: ${riskCheck.reason}`);
            await riskManagementService.logRejectedTrade(strategy.userId, symbol, result.signal, riskCheck.reason || 'Risk check failed');
            this.emit('risk_blocked', { strategyId: strategy.id, reason: riskCheck.reason });
            return;
        }

        // LIVE_SAFE_MODE: disable auto re-entry — only 1 trade per strategy per day
        if (env.LIVE_SAFE_MODE && strategy.todayTradeCount > 0) {
            const reentryReason = `LIVE_SAFE_MODE: re-entry disabled — "${strategy.name}" already traded ${strategy.todayTradeCount}x today`;
            logger.info(`🔒 LIVE_SAFE_MODE: re-entry blocked for ${strategy.name} (${strategy.todayTradeCount} trades today)`);
            await riskManagementService.logRejectedTrade(strategy.userId, symbol, result.signal, reentryReason);
            return;
        }

        // 8f. Calculate SL and TP prices
        const stopLossPrice = result.signal === Signal.BUY
            ? entryPrice * (1 - stopLossPercent / 100)
            : entryPrice * (1 + stopLossPercent / 100);
        const takeProfitPrice = takeProfitPercent > 0
            ? (result.signal === Signal.BUY
                ? entryPrice * (1 + takeProfitPercent / 100)
                : entryPrice * (1 - takeProfitPercent / 100))
            : entryPrice * (result.signal === Signal.BUY ? 1.05 : 0.95); // default 5% TP

        // 9. Log slippage-adjusted entry
        const slippageAdj = slippageModel.estimate(symbol,
            result.signal === Signal.BUY ? 'BUY' : 'SELL', entryPrice, effectiveQty);
        const adjustedEntry = slippageAdj.adjustedEntry;

        logger.info(`📊 SIGNAL: ${result.signal} ${symbol} | Strategy: ${strategy.name} | Qty: ${effectiveQty} | Entry: ₹${entryPrice.toFixed(2)} (adj ₹${adjustedEntry.toFixed(2)}) | SL: ₹${stopLossPrice.toFixed(2)} | TP: ₹${takeProfitPrice.toFixed(2)} | Risk: ₹${(effectiveQty * entryPrice * stopLossPercent / 100).toFixed(0)} | Slip: ${slippageAdj.slippagePct}%`);

        // Log trade entry to audit trail
        await riskManagementService.logTrade(strategy.userId, {
            strategyId: strategy.id,
            symbol,
            side: result.signal === Signal.BUY ? 'BUY' : 'SELL',
            entryPrice,
            stopLoss: stopLossPrice,
            takeProfit: takeProfitPrice,
            quantity: effectiveQty,
            timestamp: new Date(),
            reason: result.reason || `Signal: ${result.signal} (${(result.confidence * 100).toFixed(0)}% confidence)`,
        });

        // 10. Enqueue order (serialised, de-duplicated, rate-limited via ExecutionQueue)
        const queued = executionQueue.enqueue({
            id: uuidv4(),
            userId: strategy.userId,
            strategyId: strategy.id,
            symbol: strategy.symbol,
            exchange: strategy.exchange,
            side: result.signal === Signal.BUY ? 'BUY' : 'SELL',
            quantity: effectiveQty,
            orderType: 'MARKET',
            stopLoss: stopLossPrice,
            takeProfit: takeProfitPrice,
            priority: Math.round(result.confidence * 10), // higher confidence = higher priority
            enqueuedAt: new Date(),
        });

        if (queued) {
            this.totalOrders++;
            strategy.todayTradeCount++;
            this.emit('order_queued', {
                strategyId: strategy.id,
                strategyName: strategy.name,
                symbol,
                side: result.signal,
                quantity: effectiveQty,
                stopLoss: stopLossPrice,
                takeProfit: takeProfitPrice,
            });
        } else {
            logger.warn(`⏭ Order not queued (dedup/full) for ${strategy.name} ${symbol}`);
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
