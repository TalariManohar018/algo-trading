/**
 * Generate mock OHLCV candle data for backtesting
 * Creates realistic price movements for testing strategies
 */

export interface MockCandle {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: bigint;
}

export function generateMockCandles(
    symbol: string,
    startDate: Date,
    endDate: Date,
    basePrice: number = 100,
    volatility: number = 0.02
): MockCandle[] {
    const candles: MockCandle[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);

    if (days < 1) {
        throw new Error('End date must be after start date');
    }

    let currentPrice = basePrice;
    const currentDate = new Date(startDate);

    // Generate trend and noise
    const trendDirection = Math.random() > 0.5 ? 1 : -1;
    const trendStrength = 0.0005; // 0.05% daily trend

    for (let i = 0; i < days; i++) {
        // Add trend component
        const trend = trendDirection * trendStrength * currentPrice;
        
        // Add random walk
        const randomChange = (Math.random() - 0.5) * 2 * volatility * currentPrice;
        
        // Calculate OHLC
        const open = currentPrice;
        const change = trend + randomChange;
        const close = open + change;
        
        // High and low with some intraday volatility
        const intradayVolatility = Math.abs(change) * (1 + Math.random() * 0.5);
        const high = Math.max(open, close) + intradayVolatility * Math.random();
        const low = Math.min(open, close) - intradayVolatility * Math.random();
        
        // Volume (random between 100k and 1M)
        const volume = BigInt(Math.floor(100000 + Math.random() * 900000));

        candles.push({
            timestamp: new Date(currentDate),
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
            volume
        });

        currentPrice = close;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return candles;
}

/**
 * Get base price for common symbols
 */
export function getBasePrice(symbol: string): number {
    const basePrices: Record<string, number> = {
        'NIFTY': 21450,
        'BANKNIFTY': 47890,
        'RELIANCE': 2850,
        'TCS': 3950,
        'INFY': 1520,
        'HDFC': 1650,
        'ICICI': 1050,
        'SBIN': 625,
    };

    return basePrices[symbol.toUpperCase()] || 100;
}
