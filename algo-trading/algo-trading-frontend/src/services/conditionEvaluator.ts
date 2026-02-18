import { Candle } from './marketDataSimulator';

export interface StrategyCondition {
    indicatorType: string;
    conditionType: string;
    value: number;
    period?: number;
    logic?: 'AND' | 'OR';
}

export interface EvaluationState {
    previousCandles: Candle[];
    indicators: Record<string, number>;
}

class ConditionEvaluator {
    evaluateConditions(
        conditions: StrategyCondition[],
        candle: Candle,
        state: EvaluationState
    ): boolean {
        if (!conditions || conditions.length === 0) {
            return false;
        }

        // Calculate indicators
        const indicators = this.calculateIndicators(candle, state.previousCandles);

        // Evaluate first condition
        let result = this.evaluateSingleCondition(conditions[0], candle, indicators);

        // Evaluate subsequent conditions with logic
        for (let i = 1; i < conditions.length; i++) {
            const condition = conditions[i];
            const conditionResult = this.evaluateSingleCondition(condition, candle, indicators);

            if (condition.logic === 'OR') {
                result = result || conditionResult;
            } else {
                result = result && conditionResult;
            }
        }

        return result;
    }

    private evaluateSingleCondition(
        condition: StrategyCondition,
        candle: Candle,
        indicators: Record<string, number>
    ): boolean {
        const indicatorValue = this.getIndicatorValue(condition.indicatorType, candle, indicators);

        if (indicatorValue === undefined) {
            return false;
        }

        const targetValue = condition.value;

        switch (condition.conditionType) {
            case 'GREATER_THAN':
                return indicatorValue > targetValue;
            case 'LESS_THAN':
                return indicatorValue < targetValue;
            case 'GREATER_THAN_EQUAL':
                return indicatorValue >= targetValue;
            case 'LESS_THAN_EQUAL':
                return indicatorValue <= targetValue;
            case 'EQUALS':
                return Math.abs(indicatorValue - targetValue) < 0.01;
            case 'CROSS_ABOVE':
                return indicatorValue > targetValue;
            case 'CROSS_BELOW':
                return indicatorValue < targetValue;
            default:
                return false;
        }
    }

    private getIndicatorValue(
        indicatorType: string,
        candle: Candle,
        indicators: Record<string, number>
    ): number | undefined {
        switch (indicatorType) {
            case 'PRICE':
            case 'CLOSE':
                return candle.close;
            case 'OPEN':
                return candle.open;
            case 'HIGH':
                return candle.high;
            case 'LOW':
                return candle.low;
            case 'VOLUME':
                return candle.volume;
            case 'RSI':
                return indicators['RSI'] || 50;
            case 'EMA':
                return indicators['EMA'] || candle.close;
            case 'SMA':
                return indicators['SMA'] || candle.close;
            case 'MACD':
                return indicators['MACD'] || 0;
            default:
                return candle.close;
        }
    }

    private calculateIndicators(
        candle: Candle,
        previousCandles: Candle[]
    ): Record<string, number> {
        const indicators: Record<string, number> = {};

        // Simplified indicators (for paper trading)
        indicators['PRICE'] = candle.close;
        indicators['RSI'] = this.calculateSimpleRSI(candle, previousCandles);
        indicators['EMA'] = this.calculateSimpleEMA(candle, previousCandles);
        indicators['SMA'] = this.calculateSimpleSMA(candle, previousCandles);
        indicators['MACD'] = 0;

        return indicators;
    }

    private calculateSimpleRSI(_candle: Candle, previousCandles: Candle[]): number {
        if (previousCandles.length < 14) {
            return 50; // Neutral
        }

        const recentCandles = previousCandles.slice(-14);
        let gains = 0;
        let losses = 0;

        for (let i = 1; i < recentCandles.length; i++) {
            const change = recentCandles[i].close - recentCandles[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / 14;
        const avgLoss = losses / 14;

        if (avgLoss === 0) {
            return 100;
        }

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return rsi;
    }

    private calculateSimpleEMA(candle: Candle, previousCandles: Candle[]): number {
        if (previousCandles.length === 0) {
            return candle.close;
        }

        const period = 12;
        const multiplier = 2 / (period + 1);

        let ema = previousCandles[0].close;
        for (const prevCandle of previousCandles.slice(1)) {
            ema = (prevCandle.close - ema) * multiplier + ema;
        }

        return (candle.close - ema) * multiplier + ema;
    }

    private calculateSimpleSMA(candle: Candle, previousCandles: Candle[]): number {
        const period = 20;
        const recentCandles = [...previousCandles.slice(-period + 1), candle];

        const sum = recentCandles.reduce((acc, c) => acc + c.close, 0);
        return sum / recentCandles.length;
    }
}

export const conditionEvaluator = new ConditionEvaluator();
