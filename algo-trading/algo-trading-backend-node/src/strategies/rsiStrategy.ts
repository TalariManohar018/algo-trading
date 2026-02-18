// ============================================================
// RSI STRATEGY (Mean Reversion)
// ============================================================
// Logic:
// - BUY when RSI drops below oversold level and starts recovering
// - SELL when RSI rises above overbought level or hits target
// - Confirmation: Price must be above SMA for buy (trend filter)
// 
// Parameters:
// - rsiPeriod: RSI calculation period (default: 14)
// - oversold: RSI level to trigger buy (default: 30)
// - overbought: RSI level to trigger sell (default: 70)
// - smaPeriod: Trend filter SMA period (default: 50)
// - atrPeriod: ATR for stop-loss (default: 14)
// - atrMultiplier: SL distance in ATR units (default: 2)
// ============================================================

import { IStrategy, Signal, StrategyConfig, StrategyResult } from './base';
import { CandleInput, rsiArray, sma as calcSma, atr as calcAtr } from './indicators';

export class RSIStrategy implements IStrategy {
    readonly name = 'RSI';
    readonly requiredBars = 60;

    evaluate(candles: CandleInput[], config: StrategyConfig, hasOpenPosition: boolean): StrategyResult {
        const params = { ...this.getDefaultParameters(), ...config.parameters };
        const { rsiPeriod, oversold, overbought, smaPeriod, atrPeriod, atrMultiplier } = params;

        // Calculate indicators
        const rsiValues = rsiArray(candles, rsiPeriod);
        const currentRsi = rsiValues[rsiValues.length - 1];
        const prevRsi = rsiValues.length >= 2 ? rsiValues[rsiValues.length - 2] : currentRsi;
        const currentSma = calcSma(candles, smaPeriod);
        const currentAtr = calcAtr(candles, atrPeriod);
        const currentPrice = candles[candles.length - 1].close;

        const indicators: Record<string, number> = {
            rsi: currentRsi,
            prevRsi: prevRsi,
            sma: currentSma,
            atr: currentAtr,
            price: currentPrice,
        };

        // ─── ENTRY: RSI recovers from oversold + price above SMA ─
        if (!hasOpenPosition) {
            const rsiRecovering = prevRsi <= oversold && currentRsi > oversold;
            const aboveTrend = currentPrice > currentSma;

            if (rsiRecovering && aboveTrend) {
                const stopLoss = currentPrice - currentAtr * atrMultiplier;
                const risk = currentPrice - stopLoss;
                const takeProfit = currentPrice + risk * 2; // 2:1 R:R

                return {
                    signal: Signal.BUY,
                    confidence: this.calculateEntryConfidence(currentRsi, oversold, currentPrice, currentSma),
                    reason: `RSI recovered from oversold (${prevRsi.toFixed(1)} → ${currentRsi.toFixed(1)}), price above SMA (${currentSma.toFixed(2)})`,
                    indicators,
                    stopLoss: Math.round(stopLoss * 100) / 100,
                    takeProfit: Math.round(takeProfit * 100) / 100,
                };
            }
        }

        // ─── EXIT: RSI reaches overbought ───────────────────────
        if (hasOpenPosition) {
            if (currentRsi >= overbought) {
                return {
                    signal: Signal.SELL,
                    confidence: (currentRsi - overbought) / (100 - overbought),
                    reason: `RSI overbought at ${currentRsi.toFixed(1)} (threshold: ${overbought})`,
                    indicators,
                };
            }

            // Also exit if RSI was high and starts dropping sharply
            if (prevRsi > 60 && currentRsi < prevRsi - 10) {
                return {
                    signal: Signal.SELL,
                    confidence: 0.6,
                    reason: `RSI dropping sharply: ${prevRsi.toFixed(1)} → ${currentRsi.toFixed(1)}`,
                    indicators,
                };
            }
        }

        // ─── HOLD ───────────────────────────────────────────────
        return {
            signal: Signal.HOLD,
            confidence: 0,
            reason: `RSI at ${currentRsi.toFixed(1)}. No signal.`,
            indicators,
        };
    }

    validateParameters(params: Record<string, number>): void {
        if (params.rsiPeriod && params.rsiPeriod < 2) throw new Error('rsiPeriod must be >= 2');
        if (params.oversold && (params.oversold < 10 || params.oversold > 50)) {
            throw new Error('oversold must be between 10 and 50');
        }
        if (params.overbought && (params.overbought < 50 || params.overbought > 95)) {
            throw new Error('overbought must be between 50 and 95');
        }
        if (params.oversold && params.overbought && params.oversold >= params.overbought) {
            throw new Error('oversold must be less than overbought');
        }
    }

    getDefaultParameters(): Record<string, number> {
        return {
            rsiPeriod: 14,
            oversold: 30,
            overbought: 70,
            smaPeriod: 50,
            atrPeriod: 14,
            atrMultiplier: 2,
        };
    }

    getDescription(): string {
        return `RSI Mean Reversion: Buys when RSI recovers from oversold levels with a trend filter (price above SMA). Sells when RSI reaches overbought levels. Uses ATR-based stop-loss.`;
    }

    private calculateEntryConfidence(rsi: number, oversold: number, price: number, sma: number): number {
        // How far RSI is from oversold (just barely recovered = lower confidence)
        const rsiScore = Math.min((rsi - oversold) / 10, 1) * 0.5;
        // How far price is above SMA (stronger trend = higher confidence)
        const trendScore = Math.min(((price - sma) / sma) * 100, 2) / 2 * 0.5;
        return Math.min(rsiScore + trendScore, 1);
    }
}
