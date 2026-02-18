import { orderService } from './orderService';
import { positionService } from './positionService';
import { marketDataService } from './marketDataService';
import { conditionEngine } from './conditionEngine';
import { walletManager } from './walletManager';
import { riskManager } from './riskManager';
import { apiClient } from '../api/apiClient';
import { Order, Position, RiskState, WalletState } from '../context/TradingContext';
import { Strategy } from './strategyService';
import { StrategyCondition } from '../types/strategy';

interface TradingEngineConfig {
    onOrderCreated?: (order: Order) => void;
    onOrderUpdated?: (order: Order) => void;
    onPositionCreated?: (position: Position) => void;
    onPositionUpdated?: (position: Position) => void;
    onPositionClosed?: (position: Position, pnl: number) => void;
    onEngineError?: (error: string) => void;
    onActivityLog?: (message: string, type: string) => void;
    getRiskState?: () => RiskState;
    getWalletState?: () => WalletState;
    getStrategies?: () => Strategy[];
    getPositions?: () => Position[];
    lockEngine?: (reason: string) => void;
}

class TradingEngineClass {
    private isRunning = false;
    private intervalId: number | null = null;
    private config: TradingEngineConfig = {};
    private readonly TICK_INTERVAL = 60000; // 1 minute
    private strategyTradeCount: Map<string, number> = new Map();
    private strategyLastTradeTime: Map<string, Date> = new Map();

    init(config: TradingEngineConfig) {
        this.config = config;
    }

    async start(): Promise<{ success: boolean; message: string }> {
        if (this.isRunning) {
            return { success: false, message: 'Engine already running' };
        }

        const riskState = this.config.getRiskState?.();
        if (riskState?.isLocked) {
            return {
                success: false,
                message: `Engine locked: ${riskState.lockReason}`,
            };
        }

        try {
            await apiClient.startEngine();
            
            this.isRunning = true;
            this.log('Trading engine STARTED', 'engine_started');

            this.intervalId = setInterval(() => {
                this.tick();
            }, this.TICK_INTERVAL);

            this.tick();

            return { success: true, message: 'Engine started successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to start engine' };
        }
    }

    async stop(): Promise<{ success: boolean; message: string }> {
        if (!this.isRunning) {
            return { success: false, message: 'Engine not running' };
        }

        try {
            await apiClient.stopEngine();
            
            this.isRunning = false;

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            this.log('Trading engine STOPPED', 'engine_stopped');

            return { success: true, message: 'Engine stopped successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to stop engine' };
        }
    }

    async emergencyStop(): Promise<{ success: boolean; message: string }> {
        try {
            await apiClient.emergencyStop();
            
            this.isRunning = false;

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            this.log('EMERGENCY STOP triggered - Squaring off all positions', 'emergency_stop');
            return { success: true, message: 'Emergency stop executed' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Emergency stop failed' };
        }
    }

    private async tick() {
        try {
            if (!this.isRunning) return;

            this.updateMarketPrices();

            const shouldContinue = this.checkRiskLimits();
            if (!shouldContinue) {
                this.stop();
                return;
            }

            await this.updateOpenPositions();
            await this.evaluateStrategies();

        } catch (error) {
            console.error('Engine tick error:', error);
            this.config.onEngineError?.('Engine tick failed: ' + error);
        }
    }

    private updateMarketPrices() {
        marketDataService.updateAllMarkets();
    }

    getMarketPrice(symbol: string): number {
        return marketDataService.getCurrentPrice(symbol);
    }

    private checkRiskLimits(): boolean {
        const riskState = this.config.getRiskState?.();
        const walletState = this.config.getWalletState?.();

        if (!riskState || !walletState) return true;

        // Check if new day and reset counters
        const updatedRiskState = riskManager.checkAndResetIfNewDay(riskState);
        if (updatedRiskState !== riskState) {
            this.config.getRiskState = () => updatedRiskState;
            this.log('Daily risk counters reset - New trading day', 'engine_info');
        }

        const settingsStr = localStorage.getItem('algo_trading_settings');
        if (!settingsStr) return true;

        const settings = JSON.parse(settingsStr);

        const riskLimits = {
            maxLossPerDay: settings.riskManagement.maxLossPerDay,
            maxTradesPerDay: settings.riskManagement.maxTradesPerDay,
            maxCapitalPerTrade: settings.riskManagement.maxCapitalPerTrade,
        };

        const riskCheck = riskManager.checkRiskLimits(updatedRiskState, riskLimits);

        if (riskCheck.breached) {
            this.config.lockEngine?.(riskCheck.reason || 'Risk limit breached');
            this.log(`RISK BREACH: ${riskCheck.reason}`, 'risk_breach');
            return false;
        }

        const riskSummary = riskManager.getRiskSummary(updatedRiskState, riskLimits);
        if (riskSummary.riskLevel === 'HIGH') {
            this.log(`Risk level HIGH: ${riskSummary.lossPercentage.toFixed(1)}% loss, ${riskSummary.tradesPercentage.toFixed(1)}% trades`, 'risk_warning');
        }

        return true;
    }

    private async updateOpenPositions() {
        const positions = this.config.getPositions?.() || [];
        const openPositions = positions.filter(p => p.status === 'OPEN');

        for (const position of openPositions) {
            const currentPrice = this.getMarketPrice(position.symbol);
            const updated = positionService.updatePositionPrice(position, currentPrice);
            this.config.onPositionUpdated?.(updated);

            const checkResult = positionService.shouldClosePosition(
                updated,
                1000,
                2000
            );

            if (checkResult.shouldClose) {
                await this.closePosition(updated, currentPrice, checkResult.reason);
            }
        }
    }

    private async evaluateStrategies() {
        const strategies = this.config.getStrategies?.() || [];
        const runningStrategies = strategies.filter(s => s.status === 'RUNNING');

        for (const strategy of runningStrategies) {
            await this.evaluateStrategy(strategy);
        }
    }

    private async evaluateStrategy(strategy: Strategy) {
        try {
            const currentPrice = this.getMarketPrice(strategy.symbol);
            const latestCandle = marketDataService.getLatestCandle(strategy.symbol);
            
            if (!latestCandle) {
                return;
            }

            const historicalCandles = marketDataService.getCandles(strategy.symbol, 100);
            const indicators = conditionEngine.calculateIndicators(latestCandle, historicalCandles);

            const positions = this.config.getPositions?.() || [];
            const openPositions = positionService.getOpenPositionsByStrategy(positions, String(strategy.id));
            const hasOpenPosition = openPositions.length > 0;

            if (hasOpenPosition && strategy.conditions && strategy.conditions.filter((c: any) => c.type === 'EXIT').length > 0) {
                const exitConditions = strategy.conditions
                    .filter((c: any) => c.type === 'EXIT')
                    .map((c: any) => this.mapConditionToStrategyCondition(c));
                
                const shouldExit = conditionEngine.evaluateConditions(exitConditions, indicators);
                
                if (shouldExit) {
                    this.log(`Exit signal: ${strategy.name} - ${strategy.symbol}`, 'signal_generated');
                    await this.executeSellSignal(strategy, currentPrice);
                    return;
                }
            }

            if (!hasOpenPosition && strategy.conditions && strategy.conditions.filter((c: any) => c.type === 'ENTRY').length > 0) {
                const tradeCount = this.strategyTradeCount.get(String(strategy.id)) || 0;
                const maxTrades = (strategy.parameters?.maxTradesPerDay as number) || 10;
                
                if (tradeCount >= maxTrades) {
                    return;
                }

                const lastTradeTime = this.strategyLastTradeTime.get(String(strategy.id));
                if (lastTradeTime) {
                    const timeSinceLastTrade = Date.now() - lastTradeTime.getTime();
                    if (timeSinceLastTrade < 120000) {
                        return;
                    }
                }

                const entryConditions = strategy.conditions
                    .filter((c: any) => c.type === 'ENTRY')
                    .map((c: any) => this.mapConditionToStrategyCondition(c));
                
                const shouldEnter = conditionEngine.evaluateConditions(entryConditions, indicators);
                
                if (shouldEnter) {
                    this.log(`Entry signal: ${strategy.name} - ${strategy.symbol}`, 'signal_generated');
                    await this.executeBuySignal(strategy, currentPrice);
                    
                    this.strategyTradeCount.set(String(strategy.id), tradeCount + 1);
                    this.strategyLastTradeTime.set(String(strategy.id), new Date());
                }
            }

        } catch (error) {
            console.error(`Strategy ${strategy.name} evaluation error:`, error);
        }
    }

    private mapConditionToStrategyCondition(condition: any): StrategyCondition {
        return {
            id: String(condition.id || Math.random()),
            indicatorType: condition.indicator || condition.indicatorType || 'Price',
            conditionType: condition.operator || condition.conditionType || 'GREATER_THAN',
            value: condition.value || 0,
            logic: condition.logic || 'AND',
            period: condition.period || 14,
        };
    }

    private async executeBuySignal(strategy: Strategy, currentPrice: number) {
        const walletState = this.config.getWalletState?.();
        if (!walletState) return;

        const settingsStr = localStorage.getItem('algo_trading_settings');
        if (!settingsStr) return;
        const settings = JSON.parse(settingsStr);

        const maxCapital = walletState.balance * (settings.riskManagement.maxCapitalPerTrade / 100);
        const quantity = Math.floor(maxCapital / currentPrice);

        if (quantity === 0) {
            this.log(`Insufficient capital for trade on ${strategy.symbol}`, 'order_rejected');
            return;
        }

        const orderValue = currentPrice * quantity;

        // Use wallet manager to validate
        const canPlace = walletManager.canPlaceOrder(
            walletState,
            orderValue,
            settings.riskManagement.maxCapitalPerTrade
        );

        if (!canPlace.valid) {
            this.log(`Order validation failed: ${canPlace.reason}`, 'order_rejected');
            return;
        }

        // Reserve margin
        const marginResult = walletManager.reserveMargin(walletState, currentPrice, quantity);
        if (!marginResult.success) {
            this.log(`Margin reservation failed: ${marginResult.error}`, 'order_rejected');
            return;
        }

        // Update wallet with reserved margin
        if (marginResult.updatedWallet) {
            this.config.getWalletState = () => marginResult.updatedWallet!;
        }

        this.log(`BUY signal: ${strategy.name} - ${strategy.symbol}`, 'signal_generated');

        const result = await orderService.executeOrder(
            {
                strategyId: String(strategy.id),
                strategyName: strategy.name,
                symbol: strategy.symbol,
                side: 'BUY',
                quantity,
                orderType: 'MARKET',
            },
            currentPrice,
            (order) => {
                this.config.onOrderUpdated?.(order);
                this.log(`Order ${order.status}: ${order.symbol} x${order.quantity}`, `order_${order.status.toLowerCase()}`);
            }
        );

        if (result.success && result.order) {
            const position = await positionService.createPosition({
                order: result.order,
                currentPrice,
            });

            this.config.onPositionCreated?.(position);
            this.log(`Position opened: ${position.symbol} ${position.side} x${position.quantity} @ ₹${position.entryPrice.toFixed(2)}`, 'position_opened');
        }
    }

    private async executeSellSignal(strategy: Strategy, currentPrice: number) {
        const positions = this.config.getPositions?.() || [];
        const openPositions = positionService.getOpenPositionsByStrategy(positions, String(strategy.id));

        if (openPositions.length === 0) return;

        this.log(`SELL signal: ${strategy.name} - ${strategy.symbol}`, 'signal_generated');

        for (const position of openPositions) {
            await this.closePosition(position, currentPrice, 'Strategy exit signal');
        }
    }

    private async closePosition(position: Position, exitPrice: number, reason?: string) {
        try {
            const result = await positionService.closePosition(position, exitPrice);
            this.config.onPositionClosed?.(result.position, result.pnl);
            this.log(
                `Position closed: ${position.symbol} PnL: ₹${result.pnl.toFixed(2)} (${reason})`,
                'position_closed'
            );
        } catch (error) {
            console.error('Failed to close position:', error);
        }
    }

    private log(message: string, type: string) {
        console.log(`[TradingEngine] ${message}`);
        this.config.onActivityLog?.(message, type);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            marketPrices: marketDataService.getAllPrices(),
        };
    }

    resetDailyCounters() {
        this.strategyTradeCount.clear();
        this.log('Daily strategy counters reset', 'engine_info');
    }

    getDetailedStatus() {
        const walletState = this.config.getWalletState?.();
        const riskState = this.config.getRiskState?.();
        
        return {
            isRunning: this.isRunning,
            marketPrices: marketDataService.getAllPrices(),
            walletSummary: walletState ? walletManager.getWalletSummary(walletState) : null,
            riskSummary: riskState ? riskManager.getRiskSummary(
                riskState,
                {
                    maxLossPerDay: 5000,
                    maxTradesPerDay: 10,
                    maxCapitalPerTrade: 20,
                }
            ) : null,
            strategyTradeCount: Object.fromEntries(this.strategyTradeCount),
        };
    }
}

export const tradingEngine = new TradingEngineClass();
