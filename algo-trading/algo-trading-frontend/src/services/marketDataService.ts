import { CandleData } from '../types/strategy';

interface MarketState {
    symbol: string;
    currentPrice: number;
    candles: CandleData[];
    lastUpdate: Date;
}

class MarketDataService {
    private markets: Map<string, MarketState> = new Map();
    private readonly MAX_CANDLES = 100;

    // Initial prices for different symbols
    private readonly INITIAL_PRICES: Record<string, number> = {
        'NIFTY': 21450,
        'BANKNIFTY': 47890,
        'RELIANCE': 2850,
        'TCS': 3950,
        'INFY': 1650,
        'HDFCBANK': 1580,
        'ICICIBANK': 1020,
        'SBIN': 625,
        'TATASTEEL': 145,
        'HINDUNILVR': 2420,
    };

    constructor() {
        this.initializeMarkets();
    }

    /**
     * Initialize markets with starting prices
     */
    private initializeMarkets() {
        Object.entries(this.INITIAL_PRICES).forEach(([symbol, price]) => {
            this.markets.set(symbol, {
                symbol,
                currentPrice: price,
                candles: this.generateInitialCandles(price, 50),
                lastUpdate: new Date(),
            });
        });
    }

    /**
     * Generate initial historical candles
     */
    private generateInitialCandles(basePrice: number, count: number): CandleData[] {
        const candles: CandleData[] = [];
        let price = basePrice * 0.98; // Start slightly lower
        const now = new Date();

        for (let i = count; i > 0; i--) {
            const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals
            const candle = this.generateCandle(price, timestamp);
            candles.push(candle);
            price = candle.close;
        }

        return candles;
    }

    /**
     * Generate a single candle with realistic OHLC
     */
    private generateCandle(basePrice: number, timestamp: Date): CandleData {
        // Random movement ±0.5%
        const change = (Math.random() - 0.5) * 0.01;
        const open = basePrice;
        const close = basePrice * (1 + change);

        // High and low within reasonable range
        const volatility = Math.abs(change) + 0.002; // At least 0.2% range
        const high = Math.max(open, close) * (1 + volatility * Math.random());
        const low = Math.min(open, close) * (1 - volatility * Math.random());

        // Volume varies
        const baseVolume = 10000;
        const volume = Math.floor(baseVolume * (0.5 + Math.random()));

        return {
            open,
            high,
            low,
            close,
            volume,
            timestamp,
        };
    }

    /**
     * Update all markets with new candles
     */
    updateAllMarkets(): void {
        const now = new Date();

        this.markets.forEach((market, symbol) => {
            const lastCandle = market.candles[market.candles.length - 1];
            const newCandle = this.generateCandle(lastCandle.close, now);

            // Add new candle
            market.candles.push(newCandle);

            // Keep only last MAX_CANDLES
            if (market.candles.length > this.MAX_CANDLES) {
                market.candles = market.candles.slice(-this.MAX_CANDLES);
            }

            // Update current price
            market.currentPrice = newCandle.close;
            market.lastUpdate = now;

            this.markets.set(symbol, market);
        });
    }

    /**
     * Get current price for a symbol
     */
    getCurrentPrice(symbol: string): number {
        const market = this.markets.get(symbol);
        if (!market) {
            // If symbol not found, initialize it
            const price = 1000 + Math.random() * 1000;
            this.markets.set(symbol, {
                symbol,
                currentPrice: price,
                candles: this.generateInitialCandles(price, 50),
                lastUpdate: new Date(),
            });
            return price;
        }
        return market.currentPrice;
    }

    /**
     * Get latest candle for a symbol
     */
    getLatestCandle(symbol: string): CandleData | null {
        const market = this.markets.get(symbol);
        if (!market || market.candles.length === 0) return null;
        return market.candles[market.candles.length - 1];
    }

    /**
     * Get historical candles for a symbol
     */
    getCandles(symbol: string, count: number = 50): CandleData[] {
        const market = this.markets.get(symbol);
        if (!market) return [];
        return market.candles.slice(-count);
    }

    /**
     * Get all market prices
     */
    getAllPrices(): Record<string, number> {
        const prices: Record<string, number> = {};
        this.markets.forEach((market, symbol) => {
            prices[symbol] = market.currentPrice;
        });
        return prices;
    }

    /**
     * Check if market exists
     */
    hasMarket(symbol: string): boolean {
        return this.markets.has(symbol);
    }

    /**
     * Add new symbol to track
     */
    addSymbol(symbol: string, initialPrice?: number): void {
        if (this.markets.has(symbol)) return;

        const price = initialPrice || (1000 + Math.random() * 1000);
        this.markets.set(symbol, {
            symbol,
            currentPrice: price,
            candles: this.generateInitialCandles(price, 50),
            lastUpdate: new Date(),
        });
    }

    /**
     * Get market summary
     */
    getMarketSummary(symbol: string): {
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
        high24h: number;
        low24h: number;
        volume24h: number;
    } | null {
        const market = this.markets.get(symbol);
        if (!market || market.candles.length === 0) return null;

        const candles = market.candles;
        const firstCandle = candles[0];
        const lastCandle = candles[candles.length - 1];

        const change = lastCandle.close - firstCandle.open;
        const changePercent = (change / firstCandle.open) * 100;

        const high24h = Math.max(...candles.map(c => c.high));
        const low24h = Math.min(...candles.map(c => c.low));
        const volume24h = candles.reduce((sum, c) => sum + c.volume, 0);

        return {
            symbol,
            price: market.currentPrice,
            change,
            changePercent,
            high24h,
            low24h,
            volume24h,
        };
    }
}

export const marketDataService = new MarketDataService();
