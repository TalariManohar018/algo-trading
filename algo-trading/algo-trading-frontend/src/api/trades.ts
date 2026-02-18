import { API_BASE_URL, API_ENDPOINTS } from './config';

export interface Trade {
    id?: number;
    strategyId: number;
    symbol: string;
    orderSide: string;
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    entryTime: string;
    exitTime?: string;
    pnl?: number;
    pnlPercentage?: number;
    isOpen: boolean;
}

export interface PnlStats {
    totalPnl: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
}

export const tradeApi = {
    // Get all trades
    getAllTrades: async (open?: boolean): Promise<Trade[]> => {
        const url = open !== undefined
            ? `${API_BASE_URL}${API_ENDPOINTS.TRADES}?open=${open}`
            : `${API_BASE_URL}${API_ENDPOINTS.TRADES}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch trades');
        return response.json();
    },

    // Get trades by strategy
    getTradesByStrategy: async (strategyId: number): Promise<Trade[]> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TRADES}/strategy/${strategyId}`);
        if (!response.ok) throw new Error('Failed to fetch trades');
        return response.json();
    },

    // Get PnL stats
    getPnlStats: async (): Promise<PnlStats> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.PNL}`);
        if (!response.ok) throw new Error('Failed to fetch PnL stats');
        return response.json();
    },

    // Get PnL stats by strategy
    getPnlByStrategy: async (strategyId: number): Promise<PnlStats> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TRADES}/strategy/${strategyId}/pnl`);
        if (!response.ok) throw new Error('Failed to fetch PnL stats');
        return response.json();
    },
};
