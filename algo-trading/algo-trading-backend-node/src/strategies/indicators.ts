// ============================================================
// INDICATOR LIBRARY — Real technical indicator calculations
// ============================================================
// All indicators operate on arrays of candle data.
// Newest candle is LAST (index = length - 1).
// ============================================================

export interface CandleInput {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | bigint;
    timestamp: Date;
}

// ─── SMA (Simple Moving Average) ────────────────────────────

export function sma(candles: CandleInput[], period: number): number {
    if (candles.length < period) return NaN;
    const slice = candles.slice(-period);
    return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

export function smaArray(candles: CandleInput[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < candles.length; i++) {
        const slice = candles.slice(i - period + 1, i + 1);
        result.push(slice.reduce((sum, c) => sum + c.close, 0) / period);
    }
    return result;
}

// ─── EMA (Exponential Moving Average) ───────────────────────

export function ema(candles: CandleInput[], period: number): number {
    const values = emaArray(candles, period);
    return values.length > 0 ? values[values.length - 1] : NaN;
}

export function emaArray(candles: CandleInput[], period: number): number[] {
    if (candles.length < period) return [];

    const multiplier = 2 / (period + 1);
    const result: number[] = [];

    // First EMA = SMA of first `period` candles
    let emaValue = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    result.push(emaValue);

    for (let i = period; i < candles.length; i++) {
        emaValue = (candles[i].close - emaValue) * multiplier + emaValue;
        result.push(emaValue);
    }

    return result;
}

// ─── RSI (Relative Strength Index) ──────────────────────────
// Wilder's smoothing method (industry standard)

export function rsi(candles: CandleInput[], period: number = 14): number {
    const values = rsiArray(candles, period);
    return values.length > 0 ? values[values.length - 1] : NaN;
}

export function rsiArray(candles: CandleInput[], period: number = 14): number[] {
    if (candles.length < period + 1) return [];

    const changes: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        changes.push(candles[i].close - candles[i - 1].close);
    }

    // Initial average gain/loss
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    const result: number[] = [];
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));

    // Wilder's smoothing for subsequent values
    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] > 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + currentRs));
    }

    return result;
}

// ─── MACD (Moving Average Convergence Divergence) ───────────

export interface MACDResult {
    macd: number;      // MACD line
    signal: number;    // Signal line (EMA of MACD)
    histogram: number; // MACD - Signal
}

export function macd(
    candles: CandleInput[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
): MACDResult | null {
    if (candles.length < slowPeriod + signalPeriod) return null;

    const fastEma = emaArray(candles, fastPeriod);
    const slowEma = emaArray(candles, slowPeriod);

    // Align arrays (slow EMA starts later)
    const offset = fastPeriod < slowPeriod ? slowPeriod - fastPeriod : 0;
    const macdLine: number[] = [];

    for (let i = 0; i < slowEma.length; i++) {
        macdLine.push(fastEma[i + offset] - slowEma[i]);
    }

    if (macdLine.length < signalPeriod) return null;

    // Signal line = EMA of MACD line
    const multiplier = 2 / (signalPeriod + 1);
    let signalValue = macdLine.slice(0, signalPeriod).reduce((s, v) => s + v, 0) / signalPeriod;

    for (let i = signalPeriod; i < macdLine.length; i++) {
        signalValue = (macdLine[i] - signalValue) * multiplier + signalValue;
    }

    const currentMacd = macdLine[macdLine.length - 1];

    return {
        macd: currentMacd,
        signal: signalValue,
        histogram: currentMacd - signalValue,
    };
}

// ─── Bollinger Bands ────────────────────────────────────────

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
}

export function bollingerBands(
    candles: CandleInput[],
    period = 20,
    stdDevMultiplier = 2
): BollingerBands | null {
    if (candles.length < period) return null;

    const slice = candles.slice(-period);
    const middle = slice.reduce((sum, c) => sum + c.close, 0) / period;

    const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;

    return {
        upper,
        middle,
        lower,
        bandwidth: (upper - lower) / middle,
    };
}

// ─── ATR (Average True Range) ───────────────────────────────

export function atr(candles: CandleInput[], period = 14): number {
    if (candles.length < period + 1) return NaN;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    // Use Wilder's smoothing
    let atrValue = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < trueRanges.length; i++) {
        atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
    }

    return atrValue;
}

// ─── VWAP (Volume Weighted Average Price) ───────────────────

export function vwap(candles: CandleInput[]): number {
    if (candles.length === 0) return NaN;

    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (const c of candles) {
        const typicalPrice = (c.high + c.low + c.close) / 3;
        const vol = Number(c.volume);
        cumulativeTPV += typicalPrice * vol;
        cumulativeVolume += vol;
    }

    return cumulativeVolume === 0 ? NaN : cumulativeTPV / cumulativeVolume;
}

// ─── Crossover Detection ────────────────────────────────────

/**
 * Returns true if `fast` crossed above `slow` on the latest bar.
 * Requires at least 2 values in each array.
 */
export function crossedAbove(fast: number[], slow: number[]): boolean {
    if (fast.length < 2 || slow.length < 2) return false;
    const prevFast = fast[fast.length - 2];
    const currFast = fast[fast.length - 1];
    const prevSlow = slow[slow.length - 2];
    const currSlow = slow[slow.length - 1];
    return prevFast <= prevSlow && currFast > currSlow;
}

export function crossedBelow(fast: number[], slow: number[]): boolean {
    if (fast.length < 2 || slow.length < 2) return false;
    const prevFast = fast[fast.length - 2];
    const currFast = fast[fast.length - 1];
    const prevSlow = slow[slow.length - 2];
    const currSlow = slow[slow.length - 1];
    return prevFast >= prevSlow && currFast < currSlow;
}
