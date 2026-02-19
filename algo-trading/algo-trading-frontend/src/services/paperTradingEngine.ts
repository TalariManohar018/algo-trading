import { EventEmitter } from '../utils/EventEmitter';
import { marketDataSimulator, Candle } from './marketDataSimulator';
import { conditionEvaluator, EvaluationState } from './conditionEvaluator';
import { paperOrderService } from './paperOrderService';
import { paperPositionService } from './paperPositionService';
import { paperWalletService } from './paperWalletService';
import { Position, EngineStatus } from '../context/TradingContext';

export interface ExecutableStrategy {
    id: string;
    name: string;
    description?: string;
    symbol: string;
    instrumentType?: string;
    timeframe: string;
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    productType: string;
    entryConditions: any[];
    exitConditions: any[];
    maxTradesPerDay: number;
    tradingWindow?: {
        startTime: string;
        endTime: string;
    };
    squareOffTime?: string;
    riskConfig?: {
        maxLossPerTrade: number;
        maxProfitTarget: number;
        stopLossPercent: number;
        takeProfitPercent: number;
    };
    status: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'ACTIVE' | 'CREATED' | 'ERROR';
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ActivityEvent {
    id: string;
    type: string;
    message: string;
    timestamp: Date;
    data?: any;
}

export interface RiskLimits {
    maxLossPerDay: number;
    maxTradesPerDay: number;
    maxCapitalPerTrade: number; // percent of startingCapital
    startingCapital: number;
}

const DEFAULT_RISK_LIMITS: RiskLimits = {
    maxLossPerDay: 5000,
    maxTradesPerDay: 50,
    maxCapitalPerTrade: 10,
    startingCapital: 100000,
};

class PaperTradingEngine extends EventEmitter {
    private status: EngineStatus = 'STOPPED';
    private tradingMode: 'PAPER' | 'LIVE' = 'PAPER';
    private strategies: Map<string, ExecutableStrategy> = new Map();
    private strategyStates: Map<string, EvaluationState> = new Map();
    /** Per-strategy daily trade count */
    private dailyTradeCount: Map<string, number> = new Map();
    /** Global daily trade count across all strategies */
    private globalDailyTradeCount: number = 0;
    /** Total realised loss today (updated externally by TradingContext on position close) */
    private dailyLossAmount: number = 0;
    private riskLimits: RiskLimits = { ...DEFAULT_RISK_LIMITS };
    private unsubscribe: (() => void) | null = null;

    constructor() {
        super();
        // Restore mode from localStorage on init
        const storedSettings = localStorage.getItem('algotrader_settings');
        if (storedSettings) {
            try {
                const parsed = JSON.parse(storedSettings);
                if (parsed.tradingMode === 'LIVE' || parsed.tradingMode === 'PAPER') {
                    this.tradingMode = parsed.tradingMode;
                }
            } catch { /* ignore */ }
        }
        console.log(`[TradingEngine] Initialized | Mode: ${this.tradingMode}`);
    }

    /** Set trading mode. Paper: simulate with virtual wallet. Live: blocked if broker not connected. */
    setTradingMode(mode: 'PAPER' | 'LIVE'): void {
        const prev = this.tradingMode;
        this.tradingMode = mode;
        console.log(`[TradingEngine] Mode changed: ${prev} → ${mode}`);
        this.emitActivity('mode_change', `Trading mode set to ${mode}`, { mode });
        this.emit('modeChanged', mode);
    }

    getTradingMode(): 'PAPER' | 'LIVE' {
        return this.tradingMode;
    }

    /** Sync risk limits from Settings (called by TradingContext on settings change) */
    setRiskLimits(limits: RiskLimits): void {
        this.riskLimits = { ...limits };
        console.log(`[TradingEngine] Risk limits updated | maxLossPerDay: ₹${limits.maxLossPerDay} | maxTrades: ${limits.maxTradesPerDay} | maxCapital/trade: ${limits.maxCapitalPerTrade}%`);
    }

    /** Called by TradingContext each time a position closes with its realised loss */
    updateDailyLoss(lossAmount: number): void {
        if (lossAmount > 0) {
            this.dailyLossAmount += lossAmount;
            console.log(`[TradingEngine] Daily loss updated: ₹${this.dailyLossAmount.toFixed(2)} / ₹${this.riskLimits.maxLossPerDay}`);
            if (this.dailyLossAmount >= this.riskLimits.maxLossPerDay) {
                const msg = `Daily loss limit reached: ₹${this.dailyLossAmount.toFixed(2)} ≥ ₹${this.riskLimits.maxLossPerDay}`;
                console.warn(`[TradingEngine] RISK LOCK — ${msg}`);
                this.emitActivity('risk_breach', msg, { dailyLoss: this.dailyLossAmount, limit: this.riskLimits.maxLossPerDay });
                this.emit('riskBreached', msg);
            }
        }
    }

    getStatus(): EngineStatus {
        return this.status;
    }

    addStrategy(strategy: ExecutableStrategy): void {
        this.strategies.set(strategy.id, strategy);
        this.strategyStates.set(strategy.id, {
            previousCandles: [],
            indicators: {}
        });
        this.dailyTradeCount.set(strategy.id, 0);
    }

    removeStrategy(strategyId: string): void {
        this.strategies.delete(strategyId);
        this.strategyStates.delete(strategyId);
        this.dailyTradeCount.delete(strategyId);
    }

    updateStrategy(strategy: ExecutableStrategy): void {
        this.strategies.set(strategy.id, strategy);
    }

    getRunningStrategies(): ExecutableStrategy[] {
        return Array.from(this.strategies.values()).filter(s => s.status === 'RUNNING');
    }

    async startEngine(): Promise<void> {
        if (this.status === 'RUNNING') {
            throw new Error('Engine already running');
        }

        if (this.tradingMode === 'LIVE') {
            // Live mode: block engine start — broker not connected
            const msg = 'Live trading is disabled. Broker not connected. Switch to Paper Trading to continue.';
            console.warn(`[TradingEngine] START BLOCKED — ${msg}`);
            this.emitActivity('live_blocked', msg);
            throw new Error(msg);
        }

        this.status = 'RUNNING';
        this.emit('statusChange', 'RUNNING');
        this.emitActivity('engine_started', `Trading engine started in ${this.tradingMode} mode`);

        // Start market data simulator
        if (!marketDataSimulator.isActive()) {
            marketDataSimulator.startSimulator();
        }

        // Subscribe to candle events
        this.unsubscribe = marketDataSimulator.subscribe((candle) => {
            this.onCandleClose(candle);
        });

        const wallet = paperWalletService.getWallet();
        console.log(`[TradingEngine] Engine started | Mode: ${this.tradingMode} | Virtual wallet: ₹${wallet.balance.toFixed(2)} | Available margin: ₹${wallet.availableMargin.toFixed(2)}`);
    }

    async stopEngine(): Promise<void> {
        if (this.status === 'STOPPED') {
            return;
        }

        this.status = 'STOPPED';
        this.emit('statusChange', 'STOPPED');
        this.emitActivity('engine_stopped', 'Trading engine stopped');

        // Unsubscribe from candle events
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        console.log('Trading engine stopped');
    }

    async emergencyStop(): Promise<void> {
        this.emitActivity('emergency_stop', 'EMERGENCY STOP triggered - squaring off all positions');
        await this.stopEngine();
        this.emit('emergencyStop');
    }

    private async onCandleClose(candle: Candle): Promise<void> {
        if (this.status !== 'RUNNING') {
            return;
        }

        // Update strategy states with new candle
        this.strategies.forEach((_strategy, strategyId) => {
            const state = this.strategyStates.get(strategyId)!;
            state.previousCandles.push(candle);
            if (state.previousCandles.length > 100) {
                state.previousCandles.shift();
            }
        });

        // Evaluate each running strategy
        const runningStrategies = this.getRunningStrategies()
            .filter(s => s.symbol === candle.symbol);

        for (const strategy of runningStrategies) {
            await this.evaluateStrategy(strategy, candle);
        }

        // Update unrealized P&L for open positions
        this.emit('updateUnrealizedPnl', { symbol: candle.symbol, price: candle.close });
    }

    private async evaluateStrategy(strategy: ExecutableStrategy, candle: Candle): Promise<void> {
        const state = this.strategyStates.get(strategy.id)!;

        // Check if we have open positions for this strategy
        this.emit('checkPositions', strategy.id, async (positions: Position[]) => {
            const hasOpenPosition = positions.some(p => p.status === 'OPEN');

            if (hasOpenPosition) {
                // ── AUTO-EXIT: Stop-loss / Take-profit ──────────────────
                if (strategy.riskConfig) {
                    const slPercent = strategy.riskConfig.stopLossPercent;
                    const tpPercent = strategy.riskConfig.takeProfitPercent;
                    if (slPercent || tpPercent) {
                        const openPositions = positions.filter(p => p.status === 'OPEN' && p.strategyId === strategy.id);
                        for (const pos of openPositions) {
                            const updated = paperPositionService.updateUnrealizedPnl(pos, candle.close);
                            const { shouldClose, reason } = paperPositionService.shouldAutoExit(updated, {
                                stopLossPercent: slPercent ?? 999,
                                takeProfitPercent: tpPercent ?? 999,
                            });
                            if (shouldClose) {
                                this.emitActivity('auto_exit', `Auto-exit triggered for ${strategy.name}: ${reason}`, {
                                    strategy: strategy.name, price: candle.close, reason
                                });
                                console.log(`[TradingEngine] Auto-exit | ${strategy.name} | ${reason} | Exit price: ₹${candle.close}`);
                                this.emit('exitSignal', strategy.id, candle.close);
                                return;
                            }
                        }
                    }
                }

                // Evaluate user-defined exit conditions
                const shouldExit = conditionEvaluator.evaluateConditions(
                    strategy.exitConditions,
                    candle,
                    state
                );

                if (shouldExit) {
                    this.emitActivity('signal_generated', `EXIT signal for ${strategy.name}`, {
                        strategy: strategy.name,
                        price: candle.close
                    });
                    this.emit('exitSignal', strategy.id, candle.close);
                }
            } else {
                // Check per-strategy daily trade limit
                const tradeCount = this.dailyTradeCount.get(strategy.id) || 0;
                if (tradeCount >= strategy.maxTradesPerDay) {
                    return;
                }

                // Evaluate entry conditions
                const shouldEnter = conditionEvaluator.evaluateConditions(
                    strategy.entryConditions,
                    candle,
                    state
                );

                if (shouldEnter) {
                    this.emitActivity('signal_generated', `ENTRY signal for ${strategy.name}`, {
                        strategy: strategy.name,
                        price: candle.close
                    });
                    // Determine side from strategy config (default BUY for LONG strategies)
                    const side = (strategy as any).side === 'SELL' ? 'SELL' : 'BUY';
                    await this.handleEntrySignal(strategy, candle.close, side);
                }
            }
        });
    }

    private async handleEntrySignal(strategy: ExecutableStrategy, currentPrice: number, side: 'BUY' | 'SELL' = 'BUY'): Promise<void> {
        try {
            // ── MODE GUARD ──────────────────────────────────────────────
            console.log(`[TradingEngine] Order request | Mode: ${this.tradingMode} | Strategy: ${strategy.name} | Symbol: ${strategy.symbol} | Side: ${side} | Price: ₹${currentPrice}`);

            if (this.tradingMode === 'LIVE') {
                const msg = `[LIVE MODE BLOCKED] Order for ${strategy.name} (${strategy.symbol}) blocked — broker not connected.`;
                console.warn(`[TradingEngine] ${msg}`);
                this.emitActivity('live_blocked', msg, { strategy: strategy.name, symbol: strategy.symbol });
                return;
            }

            // ── GLOBAL DAILY TRADE LIMIT ────────────────────────────────
            if (this.globalDailyTradeCount >= this.riskLimits.maxTradesPerDay) {
                const msg = `Daily trade limit reached: ${this.globalDailyTradeCount}/${this.riskLimits.maxTradesPerDay} trades. No more orders today.`;
                console.warn(`[TradingEngine] RISK BLOCK — ${msg}`);
                this.emitActivity('risk_warning', msg);
                this.emit('riskBreached', msg);
                return;
            }

            // ── DAILY LOSS LIMIT ────────────────────────────────────────
            if (this.dailyLossAmount >= this.riskLimits.maxLossPerDay) {
                const msg = `Daily loss limit reached: ₹${this.dailyLossAmount.toFixed(2)}/₹${this.riskLimits.maxLossPerDay}. Engine locked.`;
                console.warn(`[TradingEngine] RISK BLOCK — ${msg}`);
                this.emitActivity('risk_warning', msg);
                this.emit('riskBreached', msg);
                return;
            }

            // ── MAX CAPITAL PER TRADE ───────────────────────────────────
            const maxCapital = (this.riskLimits.maxCapitalPerTrade / 100) * this.riskLimits.startingCapital;
            const requiredCapital = paperPositionService.calculateRequiredCapital(
                { quantity: strategy.quantity } as any,
                currentPrice
            );
            const tradeValue = currentPrice * strategy.quantity;

            if (tradeValue > maxCapital) {
                const msg = `Trade value ₹${tradeValue.toFixed(0)} exceeds max capital per trade ₹${maxCapital.toFixed(0)} (${this.riskLimits.maxCapitalPerTrade}% of ₹${this.riskLimits.startingCapital}). Reduce quantity.`;
                console.warn(`[TradingEngine] RISK BLOCK — ${msg}`);
                this.emitActivity('risk_warning', msg, { strategy: strategy.name });
                this.emit('orderRejected', { reason: msg, strategy: strategy.name, symbol: strategy.symbol });
                return;
            }

            // ── WALLET AVAILABILITY ─────────────────────────────────────
            console.log(`[TradingEngine] Executing PAPER ${side} trade | Symbol: ${strategy.symbol} | Qty: ${strategy.quantity} | Price: ₹${currentPrice}`);

            if (!paperWalletService.hasAvailable(requiredCapital)) {
                const wallet = paperWalletService.getWallet();
                const msg = `Insufficient margin for ${strategy.name}: need ₹${requiredCapital.toFixed(0)}, available ₹${wallet.availableMargin.toFixed(0)}`;
                this.emitActivity('risk_warning', msg, {
                    required: requiredCapital,
                    available: wallet.availableMargin
                });
                this.emit('orderRejected', { reason: msg, strategy: strategy.name, symbol: strategy.symbol });
                return;
            }

            // ── CREATE ORDER ─────────────────────────────────────────────
            const orderData = {
                strategyId: strategy.id,
                strategyName: strategy.name,
                symbol: strategy.symbol,
                side,
                quantity: strategy.quantity,
                orderType: strategy.orderType
            };

            let order = await paperOrderService.createOrder(orderData);
            this.emit('orderCreated', order);
            this.emitActivity('order_created', `${side} order created for ${strategy.name}`, { orderId: order.id });

            // Reserve capital
            if (!paperWalletService.reserveCapital(requiredCapital)) {
                this.emitActivity('risk_warning', 'Failed to reserve capital', { orderId: order.id });
                this.emit('orderRejected', { reason: 'Failed to reserve capital', strategy: strategy.name, symbol: strategy.symbol });
                return;
            }

            // ── PLACE ORDER ──────────────────────────────────────────────
            order = await paperOrderService.placeOrder(order, currentPrice);
            this.emit('orderUpdated', order);

            if (order.status === 'REJECTED') {
                const reason = order.rejectedReason || 'Simulated rejection';
                this.emitActivity('order_rejected', `Order rejected for ${strategy.name}: ${reason}`, { orderId: order.id });
                paperWalletService.releaseCapital(requiredCapital);
                this.emit('orderRejected', { reason, strategy: strategy.name, symbol: strategy.symbol });
                return;
            }

            if (order.status === 'FILLED') {
                this.emitActivity('order_filled', `${side} order filled for ${strategy.name} at ₹${order.filledPrice}`, {
                    orderId: order.id,
                    price: order.filledPrice
                });

                // Open position
                const position = paperPositionService.openPosition(order, order.filledPrice!);
                this.emit('positionOpened', position);
                this.emitActivity('position_opened', `${side} position opened for ${strategy.name} | ${strategy.symbol} @ ₹${order.filledPrice}`, {
                    positionId: position.id,
                    price: order.filledPrice
                });

                // Increment counters
                const stratCount = this.dailyTradeCount.get(strategy.id) || 0;
                this.dailyTradeCount.set(strategy.id, stratCount + 1);
                this.globalDailyTradeCount += 1;

                // ── TRADE FILLED TOAST EVENT ─────────────────────────────
                this.emit('tradeFilled', {
                    strategyName: strategy.name,
                    symbol: strategy.symbol,
                    side,
                    quantity: order.filledQuantity || order.quantity,
                    price: order.filledPrice,
                    positionId: position.id,
                });

                // ── LOG WALLET AFTER TRADE ───────────────────────────────
                const walletAfter = paperWalletService.getWallet();
                console.log(`[TradingEngine] PAPER trade executed | Type: paper | Symbol: ${strategy.symbol} | Side: ${side} | Qty: ${strategy.quantity} | Fill price: ₹${order.filledPrice} | Wallet balance: ₹${walletAfter.balance.toFixed(2)} | Available margin: ₹${walletAfter.availableMargin.toFixed(2)} | Used margin: ₹${walletAfter.usedMargin.toFixed(2)}`);
            }
        } catch (error) {
            console.error('Error handling entry signal:', error);
            this.emitActivity('error', `Error handling entry signal: ${error}`, { strategy: strategy.name });
        }
    }

    private emitActivity(type: string, message: string, data?: any): void {
        const event: ActivityEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            timestamp: new Date(),
            data
        };
        this.emit('activity', event);
    }

    resetDailyCounters(): void {
        this.dailyTradeCount.clear();
        this.globalDailyTradeCount = 0;
        this.dailyLossAmount = 0;
        this.emitActivity('system', 'Daily trade counters and loss tracking reset');
        console.log('[TradingEngine] Daily counters reset');
    }
}

export const paperTradingEngine = new PaperTradingEngine();
