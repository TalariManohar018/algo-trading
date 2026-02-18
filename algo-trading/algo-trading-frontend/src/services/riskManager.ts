import { RiskState } from '../context/TradingContext';

interface RiskLimits {
    maxLossPerDay: number;
    maxTradesPerDay: number;
    maxCapitalPerTrade: number;
}

class RiskManager {
    private readonly STORAGE_KEY = 'algo_trading_risk_state';

    /**
     * Initialize risk state
     */
    initializeRiskState(): RiskState {
        const riskState: RiskState = {
            dailyLoss: 0,
            dailyTradeCount: 0,
            isLocked: false,
            lockReason: undefined,
        };
        this.saveRiskState(riskState);
        return riskState;
    }

    /**
     * Load risk state from storage
     */
    loadRiskState(): RiskState {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return this.initializeRiskState();
            }
        }
        return this.initializeRiskState();
    }

    /**
     * Save risk state to storage
     */
    saveRiskState(riskState: RiskState): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(riskState));
    }

    /**
     * Check if risk limits are breached
     */
    checkRiskLimits(
        riskState: RiskState,
        limits: RiskLimits
    ): { breached: boolean; reason?: string } {
        // Check daily loss limit
        if (riskState.dailyLoss >= limits.maxLossPerDay) {
            return {
                breached: true,
                reason: `Daily loss limit breached: ₹${riskState.dailyLoss.toFixed(2)} / ₹${limits.maxLossPerDay}`,
            };
        }

        // Check daily trade count
        if (riskState.dailyTradeCount >= limits.maxTradesPerDay) {
            return {
                breached: true,
                reason: `Daily trade limit breached: ${riskState.dailyTradeCount} / ${limits.maxTradesPerDay} trades`,
            };
        }

        return { breached: false };
    }

    /**
     * Update risk state after trade
     */
    updateAfterTrade(riskState: RiskState, pnl: number): RiskState {
        const loss = pnl < 0 ? Math.abs(pnl) : 0;

        return {
            ...riskState,
            dailyLoss: riskState.dailyLoss + loss,
            dailyTradeCount: riskState.dailyTradeCount + 1,
        };
    }

    /**
     * Lock risk due to breach
     */
    lockRisk(riskState: RiskState, reason: string): RiskState {
        return {
            ...riskState,
            isLocked: true,
            lockReason: reason,
        };
    }

    /**
     * Unlock risk
     */
    unlockRisk(riskState: RiskState): RiskState {
        return {
            ...riskState,
            isLocked: false,
            lockReason: undefined,
        };
    }

    /**
     * Reset daily counters (call at start of new day)
     */
    resetDailyCounters(riskState: RiskState): RiskState {
        return {
            ...riskState,
            dailyLoss: 0,
            dailyTradeCount: 0,
        };
    }

    /**
     * Get risk summary
     */
    getRiskSummary(
        riskState: RiskState,
        limits: RiskLimits
    ): {
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        lossPercentage: number;
        tradesPercentage: number;
        canTrade: boolean;
    } {
        const lossPercentage = (riskState.dailyLoss / limits.maxLossPerDay) * 100;
        const tradesPercentage = (riskState.dailyTradeCount / limits.maxTradesPerDay) * 100;

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        if (lossPercentage >= 100 || tradesPercentage >= 100) {
            riskLevel = 'CRITICAL';
        } else if (lossPercentage >= 80 || tradesPercentage >= 80) {
            riskLevel = 'HIGH';
        } else if (lossPercentage >= 50 || tradesPercentage >= 50) {
            riskLevel = 'MEDIUM';
        } else {
            riskLevel = 'LOW';
        }

        return {
            riskLevel,
            lossPercentage,
            tradesPercentage,
            canTrade: !riskState.isLocked && lossPercentage < 100 && tradesPercentage < 100,
        };
    }

    /**
     * Check if new day and reset if needed
     */
    checkAndResetIfNewDay(riskState: RiskState): RiskState {
        const lastResetDate = localStorage.getItem('algo_trading_last_reset_date');
        const today = new Date().toDateString();

        if (lastResetDate !== today) {
            localStorage.setItem('algo_trading_last_reset_date', today);
            return this.resetDailyCounters(riskState);
        }

        return riskState;
    }
}

export const riskManager = new RiskManager();
