import { apiClient } from '../api/apiClient';
import { WalletState } from '../context/TradingContext';

class WalletDataService {
    async getWallet(): Promise<WalletState | null> {
        try {
            const wallet = await apiClient.getWallet();
            return {
                balance: wallet.balance || 100000,
                usedMargin: wallet.usedMargin || 0,
                availableMargin: wallet.availableMargin || wallet.balance || 100000,
                realizedPnl: wallet.realizedPnl || 0,
                unrealizedPnl: wallet.unrealizedPnl || 0,
            };
        } catch (error) {
            console.error('Failed to fetch wallet:', error);
            return {
                balance: 100000,
                usedMargin: 0,
                availableMargin: 100000,
                realizedPnl: 0,
                unrealizedPnl: 0,
            };
        }
    }
}

export const walletDataService = new WalletDataService();
