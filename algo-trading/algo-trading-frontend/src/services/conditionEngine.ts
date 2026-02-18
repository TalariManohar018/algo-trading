import { StrategyCondition, CandleData, IndicatorValues, ConditionType } from '../types/strategy';

class ConditionEngine {
    /**
     * Evaluate all conditions with AND/OR logic
     */
    evaluateConditions(conditions: StrategyCondition[], indicators: IndicatorValues): boolean {
        if (conditions.length === 0) return false;

        let result = this.evaluateSingleCondition(conditions[0], indicators);

        for (let i = 1; i < conditions.length; i++) {
            const condition = conditions[i];
            const conditionResult = this.evaluateSingleCondition(condition, indicators);

            if (condition.logic === 'OR') {
                result = result || conditionResult;
            } else {
                result = result && conditionResult;
            }
        }

        return result;
    }

    /**
     * Evaluate a single condition
     */
    private evaluateSingleCondition(condition: StrategyCondition, indicators: IndicatorValues): boolean {
        const leftValue = this.getIndicatorValue(condition.indicatorType, condition.period || 14, indicators);
        const rightValue = condition.value;

        if (leftValue === null || leftValue === undefined) return false;

        return this.compareValues(leftValue, rightValue, condition.conditionType);
    }

    /**
     * Get indicator value
     */
    private getIndicatorValue(indicatorType: string, period: number, indicators: IndicatorValues): number | null {
        switch (indicatorType) {
            case 'EMA':
                return indicators.ema?.[period] ?? null;
            case 'SMA':
                return indicators.sma?.[period] ?? null;
            case 'RSI':
                return indicators.rsi ?? null;
            case 'MACD':
                return indicators.macd?.value ?? null;
            case 'VWAP':
                return indicators.vwap ?? null;
            case 'Price':
                return indicators.price;
            case 'Volume':
                return indicators.volume;
            case 'ADX':
                return indicators.adx ?? null;
            case 'Bollinger Bands':
                return indicators.bollingerBands?.middle ?? null;
            default:
                return null;
        }
    }

    /**
     * Compare values based on condition type
     */
    private compareValues(left: number, right: number, conditionType: ConditionType): boolean {
        switch (conditionType) {
            case 'GREATER_THAN':
                return left > right;
            case 'LESS_THAN':
                return left < right;
            case 'GREATER_THAN_EQUAL':
                return left >= right;
            case 'LESS_THAN_EQUAL':
                return left <= right;
            case 'EQUALS':
                return Math.abs(left - right) < 0.0001;
            case 'CROSS_ABOVE':
                // Simplified: would need previous values
                return left > right;
            case 'CROSS_BELOW':
                // Simplified: would need previous values
                return left < right;
            default:
                return false;
        }
    }

    /**
     * Calculate mock indicator values for testing
     */
    calculateIndicators(candle: CandleData, historicalCandles: CandleData[] = []): IndicatorValues {
        const price = candle.close;
        const allCandles = [...historicalCandles, candle];

        return {
            price,
            volume: candle.volume,
            ema: {
                9: this.calculateEMA(allCandles, 9),
                14: this.calculateEMA(allCandles, 14),
                20: this.calculateEMA(allCandles, 20),
                50: this.calculateEMA(allCandles, 50),
            },
            sma: {
                9: this.calculateSMA(allCandles, 9),
                14: this.calculateSMA(allCandles, 14),
                20: this.calculateSMA(allCandles, 20),
                50: this.calculateSMA(allCandles, 50),
            },
            rsi: this.calculateRSI(allCandles, 14),
            macd: this.calculateMACD(allCandles),
            vwap: this.calculateVWAP(allCandles),
            adx: this.calculateADX(allCandles, 14),
            bollingerBands: this.calculateBollingerBands(allCandles, 20, 2),
        };
    }

    /**
     * Calculate Simple Moving Average
     */
    private calculateSMA(candles: CandleData[], period: number): number {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;

        const sum = candles.slice(-period).reduce((acc, c) => acc + c.close, 0);
        return sum / period;
    }

    /**
     * Calculate Exponential Moving Average
     */
    private calculateEMA(candles: CandleData[], period: number): number {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;

        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(candles.slice(0, period), period);

        for (let i = period; i < candles.length; i++) {
            ema = (candles[i].close - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Calculate RSI
     */
    private calculateRSI(candles: CandleData[], period: number = 14): number {
        if (candles.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = candles.length - period; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate MACD
     */
    private calculateMACD(candles: CandleData[]): { value: number; signal: number; histogram: number } {
        const ema12 = this.calculateEMA(candles, 12);
        const ema26 = this.calculateEMA(candles, 26);
        const macdLine = ema12 - ema26;

        // Simplified signal line (normally would need historical MACD values)
        const signalLine = macdLine * 0.9;
        const histogram = macdLine - signalLine;

        return {
            value: macdLine,
            signal: signalLine,
            histogram,
        };
    }

    /**
     * Calculate VWAP
     */
    private calculateVWAP(candles: CandleData[]): number {
        if (candles.length === 0) return 0;

        let totalPV = 0;
        let totalVolume = 0;

        for (const candle of candles) {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            totalPV += typicalPrice * candle.volume;
            totalVolume += candle.volume;
        }

        return totalVolume > 0 ? totalPV / totalVolume : 0;
    }

    /**
     * Calculate ADX (simplified)
     */
    private calculateADX(candles: CandleData[], period: number = 14): number {
        if (candles.length < period) return 25;

        // Simplified ADX calculation
        // Real implementation would calculate +DI, -DI, and smooth them
        return 25 + Math.random() * 20; // Mock value between 25-45
    }

    /**
     * Calculate Bollinger Bands
     */
    private calculateBollingerBands(candles: CandleData[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
        const middle = this.calculateSMA(candles, period);

        if (candles.length < period) {
            return { upper: middle, middle, lower: middle };
        }

        // Calculate standard deviation
        const prices = candles.slice(-period).map(c => c.close);
        const squaredDiffs = prices.map(p => Math.pow(p - middle, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const standardDeviation = Math.sqrt(variance);

        return {
            upper: middle + (stdDev * standardDeviation),
            middle,
            lower: middle - (stdDev * standardDeviation),
        };
    }

    /**
     * Validate strategy conditions
     */
    validateConditions(conditions: StrategyCondition[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (conditions.length === 0) {
            errors.push('At least one condition is required');
        }

        conditions.forEach((condition, index) => {
            if (!condition.indicatorType) {
                errors.push(`Condition ${index + 1}: Indicator type is required`);
            }

            if (!condition.conditionType) {
                errors.push(`Condition ${index + 1}: Condition type is required`);
            }

            if (condition.value === undefined || condition.value === null || isNaN(condition.value)) {
                errors.push(`Condition ${index + 1}: Valid numeric value is required`);
            }

            if (index > 0 && !condition.logic) {
                errors.push(`Condition ${index + 1}: Logic operator (AND/OR) is required`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

export const conditionEngine = new ConditionEngine();
