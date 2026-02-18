// Mock Trade Service
// This will be replaced with real API calls later

export interface Trade {
    id: number;
    strategyId: number;
    strategyName: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    orderSide: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number | null;
    currentPrice?: number;
    quantity: number;
    entryTime: string;
    exitTime: string | null;
    pnl: number;
    pnlPercentage: number;
    status: 'OPEN' | 'CLOSED';
    isOpen: boolean;
}

export interface Position {
    id: number;
    strategyId: number;
    strategyName: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    entryTime: string;
    pnl: number;
    pnlPercentage: number;
}

export interface PnlStats {
    totalPnl: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockTrades: Trade[] = [
    {
        id: 1,
        strategyId: 1,
        strategyName: 'Iron Condor NIFTY',
        symbol: 'NIFTY 21500 CE',
        side: 'SELL',
        orderSide: 'SELL',
        entryPrice: 125.50,
        exitPrice: 98.25,
        quantity: 50,
        entryTime: '2024-02-15T09:15:00Z',
        exitTime: '2024-02-15T15:20:00Z',
        pnl: 1362.50,
        pnlPercentage: 21.72,
        status: 'CLOSED',
        isOpen: false
    },
    {
        id: 2,
        strategyId: 2,
        strategyName: 'Bull Call Spread',
        symbol: 'BANKNIFTY 48000 CE',
        side: 'BUY',
        orderSide: 'BUY',
        entryPrice: 280.75,
        exitPrice: 315.50,
        quantity: 25,
        entryTime: '2024-02-15T10:30:00Z',
        exitTime: '2024-02-15T14:45:00Z',
        pnl: 868.75,
        pnlPercentage: 12.38,
        status: 'CLOSED',
        isOpen: false
    },
    {
        id: 3,
        strategyId: 3,
        strategyName: 'Straddle Strategy',
        symbol: 'NIFTY 21450 PE',
        side: 'BUY',
        orderSide: 'BUY',
        entryPrice: 165.25,
        exitPrice: null,
        currentPrice: 159.50,
        quantity: 75,
        entryTime: '2024-02-15T11:00:00Z',
        exitTime: null,
        pnl: -431.25,
        pnlPercentage: -3.48,
        status: 'OPEN',
        isOpen: true
    }
];

const mockPositions: Position[] = [
    {
        id: 1,
        strategyId: 3,
        strategyName: 'Straddle Strategy',
        symbol: 'NIFTY 21450 PE',
        side: 'LONG',
        entryPrice: 165.25,
        currentPrice: 159.50,
        quantity: 75,
        entryTime: '2024-02-15T11:00:00Z',
        pnl: -431.25,
        pnlPercentage: -3.48
    },
    {
        id: 2,
        strategyId: 2,
        strategyName: 'Bull Call Spread',
        symbol: 'BANKNIFTY 47500 PE',
        side: 'LONG',
        entryPrice: 215.00,
        currentPrice: 221.40,
        quantity: 30,
        entryTime: '2024-02-15T12:30:00Z',
        pnl: 192.00,
        pnlPercentage: 2.98
    }
];

class TradeService {
    private trades: Trade[] = [...mockTrades];
    private positions: Position[] = [...mockPositions];

    async getAllTrades(): Promise<Trade[]> {
        await delay(600);
        return [...this.trades];
    }

    async getTradeById(id: number): Promise<Trade> {
        await delay(400);
        const trade = this.trades.find(t => t.id === id);
        if (!trade) {
            throw new Error('Trade not found');
        }
        return { ...trade };
    }

    async getTradesByStrategy(strategyId: number): Promise<Trade[]> {
        await delay(500);
        return this.trades.filter(t => t.strategyId === strategyId);
    }

    async getOpenTrades(): Promise<Trade[]> {
        await delay(500);
        return this.trades.filter(t => t.isOpen);
    }

    async getClosedTrades(): Promise<Trade[]> {
        await delay(500);
        return this.trades.filter(t => !t.isOpen);
    }

    async getAllPositions(): Promise<Position[]> {
        await delay(500);
        return [...this.positions];
    }

    async getPositionById(id: number): Promise<Position> {
        await delay(400);
        const position = this.positions.find(p => p.id === id);
        if (!position) {
            throw new Error('Position not found');
        }
        return { ...position };
    }

    async closePosition(id: number): Promise<void> {
        await delay(700);

        const positionIndex = this.positions.findIndex(p => p.id === id);
        if (positionIndex === -1) {
            throw new Error('Position not found');
        }

        const position = this.positions[positionIndex];

        // Convert position to closed trade
        const closedTrade: Trade = {
            id: Math.max(...this.trades.map(t => t.id), 0) + 1,
            strategyId: position.strategyId,
            strategyName: position.strategyName,
            symbol: position.symbol,
            side: position.side === 'LONG' ? 'BUY' : 'SELL',
            orderSide: position.side === 'LONG' ? 'BUY' : 'SELL',
            entryPrice: position.entryPrice,
            exitPrice: position.currentPrice,
            quantity: position.quantity,
            entryTime: position.entryTime,
            exitTime: new Date().toISOString(),
            pnl: position.pnl,
            pnlPercentage: position.pnlPercentage,
            status: 'CLOSED',
            isOpen: false
        };

        this.trades.push(closedTrade);
        this.positions.splice(positionIndex, 1);
    }

    async getPnlStats(): Promise<PnlStats> {
        await delay(400);

        const closedTrades = this.trades.filter(t => !t.isOpen);
        const totalPnl = this.trades.reduce((sum, t) => sum + t.pnl, 0);
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl <= 0);
        const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

        const averageWin = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
            : 0;
        const averageLoss = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
            : 0;

        return {
            totalPnl,
            winRate,
            totalTrades: this.trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            averageWin,
            averageLoss
        };
    }

    // Method to update position prices (will be used by websocket mock)
    updatePositionPrice(id: number, newPrice: number): void {
        const position = this.positions.find(p => p.id === id);
        if (position) {
            position.currentPrice = newPrice;
            const priceDiff = newPrice - position.entryPrice;
            position.pnl = priceDiff * position.quantity * (position.side === 'LONG' ? 1 : -1);
            position.pnlPercentage = (priceDiff / position.entryPrice) * 100 * (position.side === 'LONG' ? 1 : -1);
        }
    }
}

export const tradeService = new TradeService();
