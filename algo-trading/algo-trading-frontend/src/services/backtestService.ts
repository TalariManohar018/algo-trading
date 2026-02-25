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
    async runBacktest(request: BacktestRequest, strategyName: string, symbol: string): Promise<BacktestResult> {
        try {
            const apiRequest = {
                startDate: request.startDate,
                endDate: request.endDate,
                initialCapital: request.initialCapital
            };
            
            const result = await backtestApi.runBacktest(request.strategyId, strategyName, symbol, apiRequest);
            
            // Transform backend response format to frontend format
            // Backend returns: { config, trades, metrics, equityCurve }
            const finalEquity = result.equityCurve && result.equityCurve.length > 0 
                ? result.equityCurve[result.equityCurve.length - 1].equity 
                : result.config.initialCapital;
            
            return {
                strategyId: request.strategyId,
                strategyName: strategyName,
                startDate: result.config.startDate.toString(),
                endDate: result.config.endDate.toString(),
                initialCapital: result.config.initialCapital,
                finalCapital: finalEquity,
                totalReturn: result.metrics.totalPnl || 0,
                totalReturnPercentage: result.metrics.totalReturn || 0,
                totalTrades: result.metrics.totalTrades || 0,
                winningTrades: result.metrics.winningTrades || 0,
                losingTrades: result.metrics.losingTrades || 0,
                winRate: result.metrics.winRate || 0,
                averageWin: result.metrics.averageWin || 0,
                averageLoss: result.metrics.averageLoss || 0,
                profitFactor: result.metrics.profitFactor || 0,
                maxDrawdown: result.metrics.maxDrawdown || 0,
                sharpeRatio: result.metrics.sharpeRatio || 0,
                trades: (result.trades || []).map(t => ({
                    entryTime: t.entryDate.toString(),
                    exitTime: t.exitDate.toString(),
                    orderSide: t.side as 'BUY' | 'SELL',
                    entryPrice: t.entryPrice,
                    exitPrice: t.exitPrice,
                    quantity: t.quantity,
                    pnl: t.pnl,
                    pnlPercentage: t.pnlPercent
                }))
            };
        } catch (error) {
            console.error('Failed to run backtest:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to run backtest');
        }
    }

    async getBacktestHistory(): Promise<BacktestResult[]> {
        // Not implemented in backend yet, return empty
        return [];
    }
}

export const backtestService = new BacktestService();
