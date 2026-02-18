// ============================================================
// MOVING AVERAGE CROSSOVER STRATEGY
// ============================================================
// Logic:
// - BUY when fast EMA crosses above slow EMA
// - SELL when fast EMA crosses below slow EMA
// - Stop-loss at entry - (ATR * multiplier)
// - Take-profit at entry + (ATR * multiplier * RR ratio)
//
// Parameters:
// - fastPeriod: Fast EMA period (default: 9)
// - slowPeriod: Slow EMA period (default: 21)
// - atrPeriod: ATR period for SL/TP (default: 14)
// - atrMultiplier: ATR multiplier for stop-loss (default: 1.5)
// - riskRewardRatio: Risk:Reward ratio (default: 2)
// ============================================================

import { IStrategy, Signal, StrategyConfig, StrategyResult } from './base';
import { CandleInput, emaArray, crossedAbove, crossedBelow, atr as calcAtr } from './indicators';

export class MovingAverageCrossover implements IStrategy {
    readonly name = 'MA_CROSSOVER';
    readonly requiredBars = 50; // Need enough bars for slow EMA + crossover detection

    evaluate(candles: CandleInput[], config: StrategyConfig, hasOpenPosition: boolean): StrategyResult {
        const params = { ...this.getDefaultParameters(), ...config.parameters };
        const { fastPeriod, slowPeriod, atrPeriod, atrMultiplier, riskRewardRatio } = params;

        // Calculate indicators
        const fastEma = emaArray(candles, fastPeriod);
        const slowEma = emaArray(candles, slowPeriod);
        const currentAtr = calcAtr(candles, atrPeriod);
        const currentPrice = candles[candles.length - 1].close;

        // Current indicator values
        const currentFastEma = fastEma[fastEma.length - 1];
        const currentSlowEma = slowEma[slowEma.length - 1];

        const indicators: Record<string, number> = {
            fastEma: currentFastEma,
            slowEma: currentSlowEma,
            atr: currentAtr,
            price: currentPrice,
        };

        // Align EMAs for crossover detection (slow EMA has fewer values)
        const alignedFastEma = fastEma.slice(-(slowEma.length));

        // ─── ENTRY: Fast EMA crosses above Slow EMA ─────────────
        if (!hasOpenPosition && crossedAbove(alignedFastEma, slowEma)) {
            const stopLoss = currentPrice - currentAtr * atrMultiplier;
            const risk = currentPrice - stopLoss;
            const takeProfit = currentPrice + risk * riskRewardRatio;

            return {
                signal: Signal.BUY,
                confidence: this.calculateConfidence(alignedFastEma, slowEma, 'bullish'),
                reason: `Fast EMA (${currentFastEma.toFixed(2)}) crossed above Slow EMA (${currentSlowEma.toFixed(2)})`,
                indicators,
                stopLoss: Math.round(stopLoss * 100) / 100,
                takeProfit: Math.round(takeProfit * 100) / 100,
            };
        }

        // ─── EXIT: Fast EMA crosses below Slow EMA ──────────────
        if (hasOpenPosition && crossedBelow(alignedFastEma, slowEma)) {
            return {
                signal: Signal.SELL,
                confidence: this.calculateConfidence(alignedFastEma, slowEma, 'bearish'),
                reason: `Fast EMA (${currentFastEma.toFixed(2)}) crossed below Slow EMA (${currentSlowEma.toFixed(2)})`,
                indicators,
            };
        }

        // ─── HOLD ───────────────────────────────────────────────
        return {
            signal: Signal.HOLD,
            confidence: 0,
            reason: `No crossover detected. Fast EMA: ${currentFastEma.toFixed(2)}, Slow EMA: ${currentSlowEma.toFixed(2)}`,
            indicators,
        };
    }

    validateParameters(params: Record<string, number>): void {
        const { fastPeriod, slowPeriod } = params;
        if (fastPeriod && slowPeriod && fastPeriod >= slowPeriod) {
            throw new Error('fastPeriod must be less than slowPeriod');
        }
        if (fastPeriod && fastPeriod < 2) throw new Error('fastPeriod must be >= 2');
        if (slowPeriod && slowPeriod < 5) throw new Error('slowPeriod must be >= 5');
    }

    getDefaultParameters(): Record<string, number> {
        return {
            fastPeriod: 9,
            slowPeriod: 21,
            atrPeriod: 14,
            atrMultiplier: 1.5,
            riskRewardRatio: 2,
        };
    }

    getDescription(): string {
        return `Moving Average Crossover: Generates BUY signal when the fast EMA crosses above the slow EMA, and SELL when it crosses below. Uses ATR-based stop-loss and take-profit levels.`;
    }

    /**
     * Confidence based on the strength of the crossover (gap between EMAs)
     */
    private calculateConfidence(fast: number[], slow: number[], direction: 'bullish' | 'bearish'): number {
        const currentFast = fast[fast.length - 1];
        const currentSlow = slow[slow.length - 1];
        const gap = Math.abs(currentFast - currentSlow);
        const avgPrice = (currentFast + currentSlow) / 2;
        const gapPercent = (gap / avgPrice) * 100;

        // Normalize to 0-1 (0.5% gap = full confidence)
        return Math.min(gapPercent / 0.5, 1);
    }
}
