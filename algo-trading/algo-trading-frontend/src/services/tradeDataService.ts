import { apiClient } from '../api/apiClient';

class TradeDataService {
    async getAllTrades() {
        try {
            return await apiClient.getTrades();
        } catch (error) {
            console.error('Failed to fetch trades:', error);
            return [];
        }
    }

    async getTradesByStrategy(strategyId: string) {
        try {
            return await apiClient.getTradesByStrategy(strategyId);
        } catch (error) {
            console.error('Failed to fetch strategy trades:', error);
            return [];
        }
    }

    async getTrade(id: string) {
        try {
            return await apiClient.getTrade(id);
        } catch (error) {
            console.error('Failed to fetch trade:', error);
            throw error;
        }
    }

    async getTotalPnL() {
        try {
            return await apiClient.getTotalPnL();
        } catch (error) {
            console.error('Failed to fetch total PnL:', error);
            return { totalPnL: 0, realizedPnL: 0, unrealizedPnL: 0 };
        }
    }

    async getPnLByStrategy() {
        try {
            return await apiClient.getPnLByStrategy();
        } catch (error) {
            console.error('Failed to fetch PnL by strategy:', error);
            return [];
        }
    }

    async getWinRate(strategyId: string) {
        try {
            return await apiClient.getWinRate(strategyId);
        } catch (error) {
            console.error('Failed to fetch win rate:', error);
            return { winRate: 0, totalTrades: 0, winningTrades: 0 };
        }
    }
}

export const tradeDataService = new TradeDataService();
