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
    runBacktest: async (strategyId: number, strategyName: string, symbol: string, request: BacktestRequest): Promise<BacktestResult> => {
        // Provide default parameters for common strategies
        const defaultParametersByStrategy: Record<string, Record<string, number>> = {
            'Moving Average Crossover': {
                fastPeriod: 9,
                slowPeriod: 21,
                atrPeriod: 14,
                atrMultiplier: 1.5,
                riskRewardRatio: 2
            },
            'RSI Strategy': {
                rsiPeriod: 14,
                oversoldThreshold: 30,
                overboughtThreshold: 70,
                atrPeriod: 14,
                atrMultiplier: 1.5,
                riskRewardRatio: 2
            }
        };

        const parameters = defaultParametersByStrategy[strategyName] || {};

        const payload = {
            strategyId: strategyId.toString(),
            strategyName: strategyName,
            symbol: symbol,
            timeframe: '1d',
            parameters: parameters,
            startDate: request.startDate,
            endDate: request.endDate,
            initialCapital: request.initialCapital,
            positionSizePercent: 20,
            slippageBps: 5,
            commissionBps: 3
        };
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BACKTEST}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to run backtest');
        }
        const result = await response.json();
        return result.data || result;
    },
};
