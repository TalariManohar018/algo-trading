import { API_BASE_URL, API_ENDPOINTS } from './config';

export interface BacktestRequest {
    startDate: string;
    endDate: string;
    initialCapital: number;
}

export interface BacktestResult {
    strategyId: number;
    strategyName: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    totalReturnPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    trades: Array<{
        entryTime: string;
        exitTime: string;
        entryPrice: number;
        exitPrice: number;
        quantity: number;
        pnl: number;
        pnlPercentage: number;
        orderSide: string;
    }>;
}

export const backtestApi = {
    // Run backtest for a strategy
    runBacktest: async (strategyId: number, request: BacktestRequest): Promise<BacktestResult> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BACKTEST}/${strategyId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) throw new Error('Failed to run backtest');
        return response.json();
    },
};
