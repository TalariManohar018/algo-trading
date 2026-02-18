// Mock Market Data Service
// This will be replaced with real API calls later

export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: string;
}

export interface IndexData {
    name: string;
    value: number;
    change: number;
    changePercent: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockIndexData: IndexData[] = [
    {
        name: 'NIFTY',
        value: 21450.50,
        change: 182.35,
        changePercent: 0.85
    },
    {
        name: 'BANKNIFTY',
        value: 47890.25,
        change: 531.20,
        changePercent: 1.12
    },
    {
        name: 'SENSEX',
        value: 70825.35,
        change: 425.80,
        changePercent: 0.60
    }
];

class MarketService {
    private indices: IndexData[] = [...mockIndexData];

    async getIndices(): Promise<IndexData[]> {
        await delay(300);
        return [...this.indices];
    }

    async getIndexData(name: string): Promise<IndexData> {
        await delay(200);
        const index = this.indices.find(i => i.name === name);
        if (!index) {
            throw new Error('Index not found');
        }
        return { ...index };
    }

    async getMarketData(symbol: string): Promise<MarketData> {
        await delay(400);

        const basePrice = 150 + Math.random() * 100;
        const change = (Math.random() - 0.5) * 10;

        return {
            symbol,
            price: basePrice,
            change,
            changePercent: (change / basePrice) * 100,
            volume: Math.floor(Math.random() * 1000000) + 500000,
            timestamp: new Date().toISOString()
        };
    }

    async getMarketStatus(): Promise<{ status: 'OPEN' | 'CLOSED', message: string }> {
        await delay(200);

        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        // Mock: Market open Mon-Fri, 9 AM - 3:30 PM
        if (day === 0 || day === 6) {
            return { status: 'CLOSED', message: 'Market Closed (Weekend)' };
        }

        if (hour >= 9 && hour < 15) {
            return { status: 'OPEN', message: 'Market Open' };
        } else if (hour === 15 && now.getMinutes() <= 30) {
            return { status: 'OPEN', message: 'Market Open' };
        }

        return { status: 'CLOSED', message: 'Market Closed' };
    }

    // Method to update index values (will be used by websocket mock)
    updateIndexValue(name: string, newValue: number): void {
        const index = this.indices.find(i => i.name === name);
        if (index) {
            const change = newValue - index.value;
            index.change = change;
            index.changePercent = (change / index.value) * 100;
            index.value = newValue;
        }
    }
}

export const marketService = new MarketService();
