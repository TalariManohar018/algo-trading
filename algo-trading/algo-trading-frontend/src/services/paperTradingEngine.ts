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

class PaperTradingEngine extends EventEmitter {
    private status: EngineStatus = 'STOPPED';
    private strategies: Map<string, ExecutableStrategy> = new Map();
    private strategyStates: Map<string, EvaluationState> = new Map();
    private dailyTradeCount: Map<string, number> = new Map();
    private unsubscribe: (() => void) | null = null;

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

        this.status = 'RUNNING';
        this.emit('statusChange', 'RUNNING');
        this.emitActivity('engine_started', 'Trading engine started');

        // Start market data simulator
        if (!marketDataSimulator.isActive()) {
            marketDataSimulator.startSimulator();
        }

        // Subscribe to candle events
        this.unsubscribe = marketDataSimulator.subscribe((candle) => {
            this.onCandleClose(candle);
        });

        console.log('Trading engine started');
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
                // Evaluate exit conditions
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
                // Check daily trade limit
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
                    await this.handleEntrySignal(strategy, candle.close);
                }
            }
        });
    }

    private async handleEntrySignal(strategy: ExecutableStrategy, currentPrice: number): Promise<void> {
        try {
            // Check capital availability
            const requiredCapital = paperPositionService.calculateRequiredCapital(
                { quantity: strategy.quantity } as any,
                currentPrice
            );

            if (!paperWalletService.hasAvailable(requiredCapital)) {
                this.emitActivity('risk_warning', `Insufficient capital for ${strategy.name}`, {
                    required: requiredCapital,
                    available: paperWalletService.getWallet().availableMargin
                });
                return;
            }

            // Create order
            const orderData = {
                strategyId: strategy.id,
                strategyName: strategy.name,
                symbol: strategy.symbol,
                side: 'BUY' as const,
                quantity: strategy.quantity,
                orderType: strategy.orderType
            };

            let order = await paperOrderService.createOrder(orderData);
            this.emit('orderCreated', order);
            this.emitActivity('order_created', `Order created for ${strategy.name}`, { orderId: order.id });

            // Reserve capital
            if (!paperWalletService.reserveCapital(requiredCapital)) {
                this.emitActivity('risk_warning', 'Failed to reserve capital', { orderId: order.id });
                return;
            }

            // Place order
            order = await paperOrderService.placeOrder(order, currentPrice);
            this.emit('orderUpdated', order);

            if (order.status === 'REJECTED') {
                this.emitActivity('order_rejected', `Order rejected: ${order.rejectedReason}`, { orderId: order.id });
                paperWalletService.releaseCapital(requiredCapital);
                return;
            }

            if (order.status === 'FILLED') {
                this.emitActivity('order_filled', `Order filled for ${strategy.name} at ₹${order.filledPrice}`, {
                    orderId: order.id,
                    price: order.filledPrice
                });

                // Open position
                const position = paperPositionService.openPosition(order, order.filledPrice!);
                this.emit('positionOpened', position);
                this.emitActivity('position_opened', `Position opened for ${strategy.name}`, {
                    positionId: position.id,
                    price: order.filledPrice
                });

                // Increment trade count
                const count = this.dailyTradeCount.get(strategy.id) || 0;
                this.dailyTradeCount.set(strategy.id, count + 1);
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
        this.emitActivity('system', 'Daily trade counters reset');
    }
}

export const paperTradingEngine = new PaperTradingEngine();
