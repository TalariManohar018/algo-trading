import { backtestApi } from '../api/backtest';

export interface BacktestRequest {
    strategyId: number;
    startDate: string;
    endDate: string;
    initialCapital: number;
}

export interface BacktestTrade {
    entryTime: string;
    exitTime: string;
    orderSide: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercentage: number;
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
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    trades: BacktestTrade[];
}

class BacktestService {
    async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
        try {
            const apiRequest = {
                startDate: request.startDate,
                endDate: request.endDate,
                initialCapital: request.initialCapital
            };
            
            const result = await backtestApi.runBacktest(request.strategyId, apiRequest);
            
            return {
                strategyId: result.strategyId,
                strategyName: result.strategyName,
                startDate: result.startDate,
                endDate: result.endDate,
                initialCapital: result.initialCapital,
                finalCapital: result.finalCapital,
                totalReturn: result.totalReturn,
                totalReturnPercentage: result.totalReturnPercentage,
                totalTrades: result.totalTrades,
                winningTrades: result.winningTrades,
                losingTrades: result.losingTrades,
                winRate: result.winRate,
                averageWin: result.averageWin,
                averageLoss: result.averageLoss,
                profitFactor: result.profitFactor,
                maxDrawdown: result.maxDrawdown,
                sharpeRatio: result.sharpeRatio,
                trades: result.trades.map(t => ({
                    entryTime: t.entryTime,
                    exitTime: t.exitTime,
                    orderSide: t.orderSide as 'BUY' | 'SELL',
                    entryPrice: t.entryPrice,
                    exitPrice: t.exitPrice,
                    quantity: t.quantity,
                    pnl: t.pnl,
                    pnlPercentage: t.pnlPercentage
                }))
            };
        } catch (error) {
            console.error('Failed to run backtest:', error);
            throw new Error('Failed to run backtest');
        }
    }

    async getBacktestHistory(): Promise<BacktestResult[]> {
        // Not implemented in backend yet, return empty
        return [];
    }
}

export const backtestService = new BacktestService();
