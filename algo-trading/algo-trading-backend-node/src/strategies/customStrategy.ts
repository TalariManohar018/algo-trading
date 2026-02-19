// ============================================================
// CUSTOM STRATEGY — Evaluates conditions from Strategy Builder
// ============================================================
// The frontend Strategy Builder saves entry/exit conditions as:
//   { indicatorType, conditionType, value, period }
//
// This strategy reads those from the DB "parameters" JSON and
// evaluates them with full condition support.
//
// Supported indicators: RSI, SMA, EMA, MACD, VWAP, PRICE,
//                       VOLUME, ATR, Bollinger Bands, ADX
// Supported conditions: GREATER_THAN, LESS_THAN, GT, LT,
//                       GREATER_THAN_EQUAL, LESS_THAN_EQUAL,
//                       EQUALS, CROSS_ABOVE, CROSS_BELOW
// Condition grouping:   AND (all must be true) or OR (any true)
// Debug mode:           Set debug: true in parameters JSON
// ============================================================

import { IStrategy, Signal, StrategyConfig, StrategyResult } from './base';
import {
    CandleInput,
    rsi as calcRsi,
    sma as calcSma,
    ema as calcEma,
    macd as calcMacd,
    vwap as calcVwap,
    bollingerBands,
    atr as calcAtr,
} from './indicators';
import logger from '../utils/logger';

interface Condition {
    id: string;
    indicatorType: string;
    conditionType: string;
    value: number;
    period?: number;
}

interface ConditionEvalResult {
    condition: Condition;
    indicatorValue: number;
    prevIndicatorValue: number | null;
    target: number;
    result: boolean;
    reason: string;
}

export class CustomStrategy implements IStrategy {
    readonly name = 'CUSTOM';
    readonly requiredBars = 60;

    evaluate(candles: CandleInput[], config: StrategyConfig, hasOpenPosition: boolean): StrategyResult {
        const params = config.parameters as any;
        const debug: boolean = params.debug === true;
        const strategyName: string = params._strategyName || 'CUSTOM';

        // Parse entry/exit conditions from the stored parameters
        const entryConditions: Condition[] = params.entryConditions || [];
        const exitConditions: Condition[] = params.exitConditions || [];

        // Condition grouping logic (default: AND for entry, OR for exit)
        const entryLogic: 'AND' | 'OR' = (params.entryLogic || 'AND').toUpperCase();
        const exitLogic: 'AND' | 'OR' = (params.exitLogic || 'OR').toUpperCase();

        // Calculate all indicators we might need
        const currentPrice = candles[candles.length - 1].close;
        const indicators: Record<string, number> = { price: currentPrice };

        if (debug) {
            logger.info(`🔍 [DEBUG ${strategyName}] ── Evaluating ──────────────`);
            logger.info(`🔍 [DEBUG ${strategyName}] Price: ${currentPrice.toFixed(2)} | Candles: ${candles.length} | Open position: ${hasOpenPosition}`);
            logger.info(`🔍 [DEBUG ${strategyName}] Entry conditions: ${entryConditions.length} (${entryLogic}) | Exit conditions: ${exitConditions.length} (${exitLogic})`);
        }

        // ─── ENTRY EVALUATION ─────────────────────────────────────
        if (!hasOpenPosition && entryConditions.length > 0) {
            const entryResults = entryConditions.map((cond) =>
                this.evaluateConditionDetailed(cond, candles, indicators)
            );

            if (debug) {
                logger.info(`🔍 [DEBUG ${strategyName}] ── Entry Conditions ──`);
                for (const r of entryResults) {
                    const icon = r.result ? '✅' : '❌';
                    const prevStr = r.prevIndicatorValue !== null ? ` (prev: ${r.prevIndicatorValue.toFixed(2)})` : '';
                    logger.info(`🔍 [DEBUG ${strategyName}]   ${icon} ${r.condition.indicatorType}(${r.condition.period || 14}) = ${r.indicatorValue.toFixed(2)} ${r.condition.conditionType} ${r.target} → ${r.result}${prevStr}`);
                }
            }

            const entryMet = entryLogic === 'AND'
                ? entryResults.every((r) => r.result)
                : entryResults.some((r) => r.result);

            if (debug) {
                logger.info(`🔍 [DEBUG ${strategyName}]   → Combined (${entryLogic}): ${entryMet ? 'ENTRY TRIGGERED ✅' : 'NO ENTRY ❌'}`);
            }

            if (!entryMet && debug) {
                const failedConditions = entryResults
                    .filter((r) => !r.result)
                    .map((r) => `${r.condition.indicatorType}(${r.condition.period || 14})=${r.indicatorValue.toFixed(1)} failed ${r.condition.conditionType} ${r.target}`)
                    .join('; ');
                logger.info(`🔍 [DEBUG ${strategyName}]   Entry blocked by: ${failedConditions}`);
            }

            if (entryMet) {
                const metConditions = entryResults.filter((r) => r.result);
                const riskConfig = params.riskConfig || {};
                const stopLossPercent = riskConfig.stopLossPercent || config.stopLossPercent || 2;
                const takeProfitPercent = riskConfig.takeProfitPercent || config.takeProfitPercent || 5;
                const stopLoss = currentPrice * (1 - stopLossPercent / 100);
                const takeProfit = currentPrice * (1 + takeProfitPercent / 100);

                // Confidence scales with how many conditions matched
                const confidence = Math.min(0.6 + (metConditions.length / entryConditions.length) * 0.4, 1.0);

                const reason = metConditions
                    .map((r) => `${r.condition.indicatorType}(${r.condition.period || 14})=${r.indicatorValue.toFixed(1)} ${r.condition.conditionType} ${r.target}`)
                    .join(', ');

                return {
                    signal: Signal.BUY,
                    confidence,
                    reason: `Entry [${entryLogic}]: ${reason}`,
                    indicators,
                    stopLoss: Math.round(stopLoss * 100) / 100,
                    takeProfit: Math.round(takeProfit * 100) / 100,
                };
            }
        }

        // ─── EXIT EVALUATION ──────────────────────────────────────
        if (hasOpenPosition && exitConditions.length > 0) {
            const exitResults = exitConditions.map((cond) =>
                this.evaluateConditionDetailed(cond, candles, indicators)
            );

            if (debug) {
                logger.info(`🔍 [DEBUG ${strategyName}] ── Exit Conditions ──`);
                for (const r of exitResults) {
                    const icon = r.result ? '✅' : '❌';
                    const prevStr = r.prevIndicatorValue !== null ? ` (prev: ${r.prevIndicatorValue.toFixed(2)})` : '';
                    logger.info(`🔍 [DEBUG ${strategyName}]   ${icon} ${r.condition.indicatorType}(${r.condition.period || 14}) = ${r.indicatorValue.toFixed(2)} ${r.condition.conditionType} ${r.target} → ${r.result}${prevStr}`);
                }
            }

            const exitMet = exitLogic === 'OR'
                ? exitResults.some((r) => r.result)
                : exitResults.every((r) => r.result);

            if (debug) {
                logger.info(`🔍 [DEBUG ${strategyName}]   → Combined (${exitLogic}): ${exitMet ? 'EXIT TRIGGERED ✅' : 'NO EXIT ❌'}`);
            }

            if (exitMet) {
                const triggeredExits = exitResults.filter((r) => r.result);
                const confidence = Math.min(0.6 + (triggeredExits.length / exitConditions.length) * 0.4, 1.0);

                const reason = triggeredExits
                    .map((r) => `${r.condition.indicatorType}(${r.condition.period || 14})=${r.indicatorValue.toFixed(1)} ${r.condition.conditionType} ${r.target}`)
                    .join(', ');

                return {
                    signal: Signal.SELL,
                    confidence,
                    reason: `Exit [${exitLogic}]: ${reason}`,
                    indicators,
                };
            }
        }

        // ─── HOLD ─────────────────────────────────────────────────
        if (debug) {
            logger.info(`🔍 [DEBUG ${strategyName}]   → HOLD`);
        }

        return {
            signal: Signal.HOLD,
            confidence: 0,
            reason: hasOpenPosition
                ? `Waiting for exit — ${exitConditions.length} exit condition(s) not met`
                : `Waiting for entry — not all ${entryConditions.length} entry condition(s) met`,
            indicators,
        };
    }

    // ─── DETAILED CONDITION EVALUATOR ─────────────────────────

    /**
     * Evaluate a single condition and return a detailed result object
     * (indicator value, previous value for crossovers, pass/fail, reason).
     */
    private evaluateConditionDetailed(
        cond: Condition,
        candles: CandleInput[],
        indicators: Record<string, number>,
    ): ConditionEvalResult {
        const period = cond.period || 14;
        const indicatorValue = this.getIndicatorValue(cond.indicatorType, candles, period, indicators);
        const target = cond.value;
        let prevIndicatorValue: number | null = null;
        let result = false;
        let reason = '';

        if (isNaN(indicatorValue)) {
            return {
                condition: cond,
                indicatorValue: NaN,
                prevIndicatorValue: null,
                target,
                result: false,
                reason: `${cond.indicatorType} returned NaN (not enough data?)`,
            };
        }

        switch (cond.conditionType) {
            case 'GREATER_THAN':
            case 'GT':
                result = indicatorValue > target;
                reason = `${indicatorValue.toFixed(2)} ${result ? '>' : '≤'} ${target}`;
                break;

            case 'LESS_THAN':
            case 'LT':
                result = indicatorValue < target;
                reason = `${indicatorValue.toFixed(2)} ${result ? '<' : '≥'} ${target}`;
                break;

            case 'GREATER_THAN_EQUAL':
                result = indicatorValue >= target;
                reason = `${indicatorValue.toFixed(2)} ${result ? '≥' : '<'} ${target}`;
                break;

            case 'LESS_THAN_EQUAL':
                result = indicatorValue <= target;
                reason = `${indicatorValue.toFixed(2)} ${result ? '≤' : '>'} ${target}`;
                break;

            case 'EQUALS':
                result = Math.abs(indicatorValue - target) < 0.01;
                reason = `${indicatorValue.toFixed(2)} ${result ? '==' : '≠'} ${target}`;
                break;

            case 'CROSS_ABOVE': {
                prevIndicatorValue = this.getIndicatorValue(
                    cond.indicatorType,
                    candles.slice(0, -1),
                    period,
                    {},
                );
                if (!isNaN(prevIndicatorValue)) {
                    result = prevIndicatorValue <= target && indicatorValue > target;
                    reason = `prev=${prevIndicatorValue.toFixed(2)} → now=${indicatorValue.toFixed(2)}, threshold=${target} — ${result ? 'CROSSED ABOVE' : 'no cross'}`;
                } else {
                    reason = 'previous value unavailable for crossover';
                }
                break;
            }

            case 'CROSS_BELOW': {
                prevIndicatorValue = this.getIndicatorValue(
                    cond.indicatorType,
                    candles.slice(0, -1),
                    period,
                    {},
                );
                if (!isNaN(prevIndicatorValue)) {
                    result = prevIndicatorValue >= target && indicatorValue < target;
                    reason = `prev=${prevIndicatorValue.toFixed(2)} → now=${indicatorValue.toFixed(2)}, threshold=${target} — ${result ? 'CROSSED BELOW' : 'no cross'}`;
                } else {
                    reason = 'previous value unavailable for crossover';
                }
                break;
            }

            default:
                result = indicatorValue > target;
                reason = `(fallback GT) ${indicatorValue.toFixed(2)} > ${target}`;
        }

        return {
            condition: cond,
            indicatorValue,
            prevIndicatorValue,
            target,
            result,
            reason,
        };
    }

    // ─── INDICATOR CALCULATOR ─────────────────────────────────

    /**
     * Compute an indicator value for the given candles.
     * Supports: RSI, SMA, EMA, MACD, MACD_SIGNAL, MACD_HISTOGRAM,
     *           VWAP, PRICE, VOLUME, ATR, ADX, BB (upper/middle/lower)
     */
    private getIndicatorValue(
        type: string,
        candles: CandleInput[],
        period: number,
        indicators: Record<string, number>,
    ): number {
        let value: number;

        switch (type.toUpperCase()) {
            case 'RSI':
                value = calcRsi(candles, period);
                break;

            case 'SMA':
                value = calcSma(candles, period);
                break;

            case 'EMA':
                value = calcEma(candles, period);
                break;

            case 'MACD': {
                const m = calcMacd(candles);
                if (!m) { value = NaN; break; }
                value = m.macd;
                indicators['macd_signal'] = m.signal;
                indicators['macd_histogram'] = m.histogram;
                break;
            }

            case 'MACD_SIGNAL': {
                const m = calcMacd(candles);
                value = m ? m.signal : NaN;
                break;
            }

            case 'MACD_HISTOGRAM': {
                const m = calcMacd(candles);
                value = m ? m.histogram : NaN;
                break;
            }

            case 'VWAP':
                value = calcVwap(candles);
                break;

            case 'PRICE':
                value = candles[candles.length - 1].close;
                break;

            case 'VOLUME':
                value = Number(candles[candles.length - 1].volume);
                break;

            case 'ATR':
                value = calcAtr(candles, period);
                break;

            case 'ADX':
                value = this.calculateADX(candles, period);
                break;

            case 'BOLLINGER BANDS':
            case 'BB':
            case 'BB_UPPER': {
                const bb = bollingerBands(candles, period);
                if (!bb) { value = NaN; break; }
                value = bb.upper;
                indicators['bb_middle'] = bb.middle;
                indicators['bb_lower'] = bb.lower;
                break;
            }

            case 'BB_LOWER': {
                const bb = bollingerBands(candles, period);
                value = bb ? bb.lower : NaN;
                break;
            }

            case 'BB_MIDDLE': {
                const bb = bollingerBands(candles, period);
                value = bb ? bb.middle : NaN;
                break;
            }

            default:
                value = NaN;
        }

        // Store in indicators map for logging
        if (indicators) {
            const key = `${type.toLowerCase()}${period !== 14 ? `_${period}` : ''}`;
            indicators[key] = value;
        }

        return value;
    }

    /**
     * Simple ADX calculation using +DI/-DI smoothed directional movement.
     */
    private calculateADX(candles: CandleInput[], period: number): number {
        if (candles.length < period + 1) return NaN;

        let plusDMSum = 0;
        let minusDMSum = 0;
        let trSum = 0;

        for (let i = 1; i <= period; i++) {
            const idx = candles.length - period - 1 + i;
            const curr = candles[idx];
            const prev = candles[idx - 1];

            const highDiff = curr.high - prev.high;
            const lowDiff = prev.low - curr.low;

            plusDMSum += highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
            minusDMSum += lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

            const tr = Math.max(
                curr.high - curr.low,
                Math.abs(curr.high - prev.close),
                Math.abs(curr.low - prev.close),
            );
            trSum += tr;
        }

        if (trSum === 0) return 0;

        const plusDI = (plusDMSum / trSum) * 100;
        const minusDI = (minusDMSum / trSum) * 100;
        const diSum = plusDI + minusDI;

        return diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
    }

    validateParameters(_params: Record<string, number>): void {
        // Custom strategies accept any parameters from the builder
    }

    getDefaultParameters(): Record<string, number> {
        return {};
    }

    getDescription(): string {
        return 'Custom strategy built with the Strategy Builder UI. Evaluates user-defined entry/exit conditions using technical indicators with AND/OR grouping, crossover detection, and debug logging.';
    }
}
