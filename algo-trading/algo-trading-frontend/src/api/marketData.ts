import { API_BASE_URL } from './config';

export interface CandleData {
    symbol: string;
    timeframe: string;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MarketDataStatus {
    running: boolean;
}

export const marketDataApi = {
    // Start market data simulator
    start: async (): Promise<MarketDataStatus> => {
        const response = await fetch(`${API_BASE_URL}/api/market-data/start`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to start market data');
        return response.json();
    },

    // Stop market data simulator
    stop: async (): Promise<MarketDataStatus> => {
        const response = await fetch(`${API_BASE_URL}/api/market-data/stop`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to stop market data');
        return response.json();
    },

    // Get market data status
    getStatus: async (): Promise<MarketDataStatus> => {
        const response = await fetch(`${API_BASE_URL}/api/market-data/status`);
        if (!response.ok) throw new Error('Failed to fetch market data status');
        return response.json();
    },

    // Get current price for a symbol
    getCurrentPrice: async (symbol: string): Promise<{ symbol: string; price: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/market-data/price/${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch current price');
        return response.json();
    },

    // Get historical candles
    getHistoricalCandles: async (
        symbol: string,
        timeframe: string = '1m',
        count: number = 100
    ): Promise<CandleData[]> => {
        const response = await fetch(
            `${API_BASE_URL}/api/market-data/candles/${symbol}?timeframe=${timeframe}&count=${count}`
        );
        if (!response.ok) throw new Error('Failed to fetch historical candles');
        return response.json();
    },
};
