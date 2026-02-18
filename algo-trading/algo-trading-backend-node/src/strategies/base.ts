// ============================================================
// BASE STRATEGY — Abstract interface all strategies implement
// ============================================================
// Design: Strategy Pattern. Each strategy is a pure function of
// candle data → signal. No side effects. The engine handles
// order placement, risk checks, and position management.
// ============================================================

import { CandleInput } from './indicators';

export enum Signal {
    BUY = 'BUY',
    SELL = 'SELL',
    HOLD = 'HOLD',
}

export interface StrategyConfig {
    symbol: string;
    quantity: number;
    parameters: Record<string, number>;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    maxTradesPerDay?: number;
}

export interface StrategyResult {
    signal: Signal;
    confidence: number;       // 0-1, how confident the signal is
    reason: string;            // Human-readable explanation
    indicators: Record<string, number>; // Computed indicator values for logging/display
    stopLoss?: number;         // Absolute price for stop-loss
    takeProfit?: number;       // Absolute price for take-profit
}

/**
 * All strategies must implement this interface.
 * 
 * Contract:
 * - evaluate() is a PURE FUNCTION of candle data
 * - No database calls, no side effects
 * - Returns Signal + metadata
 * - Called on every new candle by the trading engine
 */
export interface IStrategy {
    readonly name: string;
    readonly requiredBars: number; // Minimum candles needed before evaluation

    /**
     * Evaluate the strategy against current market data.
     * @param candles - Historical candles, newest LAST. At least `requiredBars` candles.
     * @param config - Strategy parameters
     * @param hasOpenPosition - Whether there's already an open position for this strategy
     * @returns StrategyResult with signal, confidence, and metadata
     */
    evaluate(candles: CandleInput[], config: StrategyConfig, hasOpenPosition: boolean): StrategyResult;

    /**
     * Validate that the provided parameters are valid for this strategy.
     * Throws if invalid.
     */
    validateParameters(params: Record<string, number>): void;

    /**
     * Return default parameters for this strategy.
     */
    getDefaultParameters(): Record<string, number>;

    /**
     * Get human-readable description of the strategy logic.
     */
    getDescription(): string;
}
