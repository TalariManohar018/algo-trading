import { apiClient } from '../api/apiClient';
import { RiskState } from '../context/TradingContext';

class RiskDataService {
    async getRiskState(): Promise<RiskState | null> {
        try {
            const risk = await apiClient.getRiskState();
            return {
                dailyLoss: risk.currentDayLoss || 0,
                dailyTradeCount: risk.currentDayTrades || 0,
                isLocked: risk.isLocked || false,
                lockReason: risk.lockReason || '',
            };
        } catch (error) {
            console.error('Failed to fetch risk state:', error);
            return {
                dailyLoss: 0,
                dailyTradeCount: 0,
                isLocked: false,
                lockReason: '',
            };
        }
    }

    async unlockRisk(password: string): Promise<boolean> {
        try {
            await apiClient.unlockRisk(password);
            return true;
        } catch (error) {
            console.error('Failed to unlock risk:', error);
            return false;
        }
    }

    async resetRisk(): Promise<boolean> {
        try {
            await apiClient.resetRisk();
            return true;
        } catch (error) {
            console.error('Failed to reset risk:', error);
            return false;
        }
    }
}

export const riskDataService = new RiskDataService();
