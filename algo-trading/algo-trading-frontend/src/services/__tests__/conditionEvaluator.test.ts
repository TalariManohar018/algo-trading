import { conditionEvaluator } from '../conditionEvaluator';
import { Candle } from '../marketDataSimulator';

describe('ConditionEvaluator', () => {
    const generateCandles = (closes: number[]): Candle[] => {
        return closes.map((close, i) => ({
            symbol: 'NIFTY50',
            timestamp: new Date(Date.now() - (closes.length - i) * 60000),
            open: close - 1,
            high: close + 1,
            low: close - 2,
            close,
            volume: 100000,
        }));
    };

    test('GT operator should work correctly', () => {
        const candles = generateCandles([100, 101, 102, 103, 104]);
        const condition = {
            id: '1',
            indicatorType: 'PRICE' as const,
            conditionType: 'GT' as const,
            value: 103,
            logic: 'AND' as const,
        };

        const result = conditionEvaluator.evaluate(condition, candles);
        expect(result).toBe(true);
    });

    test('LT operator should work correctly', () => {
        const candles = generateCandles([104, 103, 102, 101, 100]);
        const condition = {
            id: '1',
            indicatorType: 'PRICE' as const,
            conditionType: 'LT' as const,
            value: 103,
            logic: 'AND' as const,
        };

        const result = conditionEvaluator.evaluate(condition, candles);
        expect(result).toBe(true);
    });

    test('RSI should calculate correctly', () => {
        const candles = generateCandles([
            100, 102, 101, 103, 102, 104, 103, 105, 104, 106,
            105, 107, 106, 108, 107
        ]);

        const rsi = conditionEvaluator.calculateRSI(candles, 14);
        expect(rsi).toBeGreaterThan(0);
        expect(rsi).toBeLessThan(100);
    });

    test('EMA should calculate correctly', () => {
        const candles = generateCandles([100, 101, 102, 103, 104, 105]);
        const ema = conditionEvaluator.calculateEMA(candles, 5);
        
        expect(ema).toBeGreaterThan(candles[0].close);
        expect(ema).toBeLessThanOrEqual(candles[candles.length - 1].close);
    });

    test('SMA should calculate correctly', () => {
        const candles = generateCandles([100, 102, 104, 106, 108]);
        const sma = conditionEvaluator.calculateSMA(candles, 5);
        
        expect(sma).toBe(104); // Average of 100,102,104,106,108
    });

    test('EQ operator should work with tolerance', () => {
        const candles = generateCandles([100, 101, 102, 103, 100.1]);
        const condition = {
            id: '1',
            indicatorType: 'PRICE' as const,
            conditionType: 'EQ' as const,
            value: 100,
            logic: 'AND' as const,
        };

        const result = conditionEvaluator.evaluate(condition, candles);
        expect(result).toBe(true);
    });

    test('CROSS_ABOVE should detect crossovers', () => {
        const candles = generateCandles([95, 96, 97, 98, 101, 102]);
        const condition = {
            id: '1',
            indicatorType: 'PRICE' as const,
            conditionType: 'CROSS_ABOVE' as const,
            value: 100,
            logic: 'AND' as const,
        };

        const result = conditionEvaluator.evaluate(condition, candles);
        expect(result).toBe(true);
    });

    test('CROSS_BELOW should detect crossovers', () => {
        const candles = generateCandles([105, 104, 103, 102, 99, 98]);
        const condition = {
            id: '1',
            indicatorType: 'PRICE' as const,
            conditionType: 'CROSS_BELOW' as const,
            value: 100,
            logic: 'AND' as const,
        };

        const result = conditionEvaluator.evaluate(condition, candles);
        expect(result).toBe(true);
    });
});
