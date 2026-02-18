import { EventEmitter } from '../utils/EventEmitter';
import { Order } from '../context/TradingContext';

export interface RiskConfig {
    maxLossPerDay: number;         // absolute ₹ loss that triggers lockout
    maxTradesPerDay: number;       // max orders placed per calendar day
    maxCapitalPerOrder: number;    // % of balance a single order may use (0-100)
    maxOpenPositions: number;      // concurrent open positions
    maxDrawdownPercent: number;    // max drawdown % before RISK_LOCKED
}

export interface RiskGuard {
    maxLossPerDay: number;
    currentDayLoss: number;
    remainingRisk: number;
    tradeCountToday: number;
    maxTradesPerDay: number;
    isRiskBreached: boolean;
    breachReason?: string;
    riskStatus: 'OK' | 'WARNING' | 'RISK_LOCKED';
}

export interface PreOrderCheck {
    allowed: boolean;
    reason?: string;
}

const SETTINGS_KEY = 'algo_trading_settings';
const DEFAULT_CONFIG: RiskConfig = {
    maxLossPerDay: 5000,
    maxTradesPerDay: 50,
    maxCapitalPerOrder: 25,
    maxOpenPositions: 10,
    maxDrawdownPercent: 10,
};

class RiskService extends EventEmitter {
    private config: RiskConfig;
    private todayTradeCount: number = 0;
    private todayRealizedPnl: number = 0;
    private openPositionCount: number = 0;
    private locked: boolean = false;
    private lockReason: string | undefined;
    private dayKey: string;

    constructor() {
        super();
        this.config = this.loadConfig();
        this.dayKey = new Date().toDateString();
        this.loadDayStats();
    }

    private loadConfig(): RiskConfig {
        try {
            const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return {
                maxLossPerDay: stored.maxLossPerDay ?? DEFAULT_CONFIG.maxLossPerDay,
                maxTradesPerDay: stored.maxTradesPerDay ?? DEFAULT_CONFIG.maxTradesPerDay,
                maxCapitalPerOrder: stored.maxCapitalPerOrder ?? DEFAULT_CONFIG.maxCapitalPerOrder,
                maxOpenPositions: stored.maxOpenPositions ?? DEFAULT_CONFIG.maxOpenPositions,
                maxDrawdownPercent: stored.maxDrawdownPercent ?? DEFAULT_CONFIG.maxDrawdownPercent,
            };
        } catch {
            return { ...DEFAULT_CONFIG };
        }
    }

    private loadDayStats(): void {
        const today = new Date().toDateString();
        try {
            const trades = JSON.parse(localStorage.getItem('trading_trades') || '[]');
            const todayTrades = trades.filter((t: any) => {
                const d = new Date(t.executedAt || t.exitTime || t.entryTime).toDateString();
                return d === today;
            });
            this.todayTradeCount = todayTrades.length;
            this.todayRealizedPnl = todayTrades.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
        } catch {
            this.todayTradeCount = 0;
            this.todayRealizedPnl = 0;
        }
        try {
            const positions = JSON.parse(localStorage.getItem('trading_positions') || '[]');
            this.openPositionCount = positions.filter((p: any) => p.status === 'OPEN').length;
        } catch {
            this.openPositionCount = 0;
        }
    }

    configure(partial: Partial<RiskConfig>): void {
        this.config = { ...this.config, ...partial };
    }

    /** Check BEFORE placing an order */
    preOrderCheck(order: Order, walletBalance: number): PreOrderCheck {
        this.rollDayIfNeeded();
        if (this.locked) return { allowed: false, reason: `RISK_LOCKED: ${this.lockReason}` };

        // Day loss check
        if (this.todayRealizedPnl < 0 && Math.abs(this.todayRealizedPnl) >= this.config.maxLossPerDay) {
            this.triggerLock(`Daily loss limit breached: ₹${Math.abs(this.todayRealizedPnl).toFixed(0)} / ₹${this.config.maxLossPerDay}`);
            return { allowed: false, reason: this.lockReason };
        }

        // Trade count check
        if (this.todayTradeCount >= this.config.maxTradesPerDay) {
            return { allowed: false, reason: `Daily trade limit reached: ${this.todayTradeCount}/${this.config.maxTradesPerDay}` };
        }

        // Per-order capital check  
        const orderValue = order.quantity * (order.limitPrice || order.filledPrice || order.placedPrice || 0);
        const maxAllowed = walletBalance * (this.config.maxCapitalPerOrder / 100);
        if (orderValue > maxAllowed && maxAllowed > 0) {
            return { allowed: false, reason: `Order value ₹${orderValue.toFixed(0)} exceeds ${this.config.maxCapitalPerOrder}% of balance (₹${maxAllowed.toFixed(0)})` };
        }

        // Open positions check
        if (this.openPositionCount >= this.config.maxOpenPositions) {
            return { allowed: false, reason: `Max open positions reached: ${this.openPositionCount}/${this.config.maxOpenPositions}` };
        }

        return { allowed: true };
    }

    /** Called when a trade is recorded */
    recordTrade(pnl: number): void {
        this.rollDayIfNeeded();
        this.todayTradeCount++;
        this.todayRealizedPnl += pnl;

        if (this.todayRealizedPnl < 0 && Math.abs(this.todayRealizedPnl) >= this.config.maxLossPerDay) {
            this.triggerLock(`Daily loss limit breached: ₹${Math.abs(this.todayRealizedPnl).toFixed(0)} / ₹${this.config.maxLossPerDay}`);
        }
    }

    /** Called when positions open/close to keep count current */
    setOpenPositionCount(count: number): void {
        this.openPositionCount = count;
    }

    /** Check drawdown against wallet */
    checkDrawdown(drawdownPercent: number): void {
        if (drawdownPercent >= this.config.maxDrawdownPercent) {
            this.triggerLock(`Max drawdown breached: ${drawdownPercent.toFixed(1)}% / ${this.config.maxDrawdownPercent}%`);
        }
    }

    private triggerLock(reason: string): void {
        this.locked = true;
        this.lockReason = reason;
        this.emit('risk:locked', { reason });
    }

    unlock(): void {
        this.locked = false;
        this.lockReason = undefined;
        this.emit('risk:unlocked', {});
    }

    isLocked(): boolean { return this.locked; }

    private rollDayIfNeeded(): void {
        const today = new Date().toDateString();
        if (today !== this.dayKey) {
            this.dayKey = today;
            this.todayTradeCount = 0;
            this.todayRealizedPnl = 0;
            if (this.locked) this.unlock();
        }
    }

    /** Synchronous getter for dashboard/components */
    getRiskGuard(): RiskGuard {
        this.rollDayIfNeeded();
        const remainingRisk = this.config.maxLossPerDay - Math.abs(Math.min(0, this.todayRealizedPnl));
        let riskStatus: 'OK' | 'WARNING' | 'RISK_LOCKED' = 'OK';
        if (this.locked) riskStatus = 'RISK_LOCKED';
        else if (remainingRisk < this.config.maxLossPerDay * 0.2) riskStatus = 'WARNING';

        return {
            maxLossPerDay: this.config.maxLossPerDay,
            currentDayLoss: this.todayRealizedPnl,
            remainingRisk: Math.max(0, remainingRisk),
            tradeCountToday: this.todayTradeCount,
            maxTradesPerDay: this.config.maxTradesPerDay,
            isRiskBreached: this.locked,
            breachReason: this.lockReason,
            riskStatus,
        };
    }

    reset(): void {
        this.todayTradeCount = 0;
        this.todayRealizedPnl = 0;
        this.openPositionCount = 0;
        this.locked = false;
        this.lockReason = undefined;
        this.config = { ...DEFAULT_CONFIG };
    }
}

export const riskService = new RiskService();
