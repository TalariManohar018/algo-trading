// ============================================================
// RISK MANAGEMENT SERVICE
// ============================================================
// Enforces hard limits BEFORE every order is placed.
// This is the last safety gate between strategy signals and
// real money. If this fails, money is lost.
//
// Checks:
// 1. Daily loss limit (absolute ₹ amount)
// 2. Per-trade size limit
// 3. Max open positions
// 4. Market hours (IST 9:15 - 15:30)
// 5. Engine lock state
// ============================================================

import prisma from '../config/database';
import { env } from '../config/env';
import { riskLogger } from '../utils/logger';
import { RiskBreachError } from '../utils/errors';

export interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
}

export class RiskManagementService {
    private maxDailyLoss: number;
    private maxTradeSize: number;
    private maxOpenPositions: number;

    constructor() {
        this.maxDailyLoss = env.MAX_DAILY_LOSS;
        this.maxTradeSize = env.MAX_TRADE_SIZE;
        this.maxOpenPositions = env.MAX_OPEN_POSITIONS;
    }

    /**
     * Full pre-order risk check. Call BEFORE placing any order.
     */
    async checkPreOrder(userId: string, orderValue: number): Promise<RiskCheckResult> {
        // 1. Check engine lock
        const riskState = await this.getRiskState(userId);
        if (riskState.isLocked) {
            return { allowed: false, reason: `LOCKED: ${riskState.lockReason || 'Risk limit breached'}` };
        }

        // 2. Daily loss limit
        if (riskState.dailyLoss >= this.maxDailyLoss) {
            await this.lockEngine(userId, `Daily loss limit reached: ₹${riskState.dailyLoss.toFixed(0)} / ₹${this.maxDailyLoss}`);
            return { allowed: false, reason: `Daily loss limit reached: ₹${riskState.dailyLoss.toFixed(0)}` };
        }

        // 3. Per-trade size
        if (orderValue > this.maxTradeSize) {
            return { allowed: false, reason: `Order value ₹${orderValue.toFixed(0)} exceeds max ₹${this.maxTradeSize}` };
        }

        // 4. Max open positions
        const openPositions = await prisma.position.count({
            where: { userId, status: 'OPEN' },
        });
        if (openPositions >= this.maxOpenPositions) {
            return { allowed: false, reason: `Max open positions reached: ${openPositions}/${this.maxOpenPositions}` };
        }

        // 5. Market hours (IST: 9:15 - 15:30, Mon-Fri)
        if (!this.isMarketOpen()) {
            return { allowed: false, reason: 'Market is closed' };
        }

        // 6. Wallet margin check
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (wallet) {
            const requiredMargin = orderValue * 0.2; // 20% margin
            if (wallet.availableMargin < requiredMargin) {
                return { allowed: false, reason: `Insufficient margin: ₹${wallet.availableMargin.toFixed(0)} < ₹${requiredMargin.toFixed(0)}` };
            }
        }

        return { allowed: true };
    }

    /**
     * Record a loss and check if daily limit is breached
     */
    async recordLoss(userId: string, amount: number): Promise<void> {
        const riskState = await prisma.riskState.update({
            where: { userId },
            data: { dailyLoss: { increment: amount } },
        });

        if (riskState.dailyLoss >= this.maxDailyLoss) {
            await this.lockEngine(userId, `Daily loss limit breached: ₹${riskState.dailyLoss.toFixed(0)}`);
            riskLogger.error('DAILY LOSS LIMIT BREACHED', { userId, dailyLoss: riskState.dailyLoss });
        }
    }

    /**
     * Lock the engine — no more trades until manually unlocked
     */
    async lockEngine(userId: string, reason: string): Promise<void> {
        await prisma.riskState.update({
            where: { userId },
            data: { isLocked: true, lockReason: reason },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId,
                event: 'RISK_BREACH',
                severity: 'CRITICAL',
                message: reason,
            },
        });

        riskLogger.error(`Engine locked: ${reason}`, { userId });
    }

    /**
     * Unlock the engine (manual admin action)
     */
    async unlockEngine(userId: string): Promise<void> {
        await prisma.riskState.update({
            where: { userId },
            data: { isLocked: false, lockReason: null },
        });
        riskLogger.info('Engine unlocked', { userId });
    }

    /**
     * Reset daily counters (called at market open)
     */
    async resetDailyCounters(userId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.riskState.update({
            where: { userId },
            data: {
                dailyLoss: 0,
                dailyTradeCount: 0,
                tradingDate: today,
                isLocked: false,
                lockReason: null,
            },
        });
        riskLogger.info('Daily counters reset', { userId });
    }

    /**
     * Get current risk state
     */
    async getRiskState(userId: string) {
        let state = await prisma.riskState.findUnique({ where: { userId } });

        if (!state) {
            state = await prisma.riskState.create({
                data: { userId, tradingDate: new Date() },
            });
        }

        // Auto-reset if it's a new trading day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (state.tradingDate < today) {
            await this.resetDailyCounters(userId);
            state = await prisma.riskState.findUnique({ where: { userId } });
        }

        return state!;
    }

    /**
     * Check if Indian stock market is open (IST: Mon-Fri 9:15-15:30)
     */
    isMarketOpen(): boolean {
        // In paper mode, always allow trading
        if (env.TRADING_MODE === 'paper') return true;

        const now = new Date();
        // Convert to IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const ist = new Date(now.getTime() + istOffset);

        const day = ist.getUTCDay();
        if (day === 0 || day === 6) return false; // Weekend

        const hours = ist.getUTCHours();
        const minutes = ist.getUTCMinutes();
        const timeInMinutes = hours * 60 + minutes;

        const marketOpen = 9 * 60 + 15;  // 09:15
        const marketClose = 15 * 60 + 30; // 15:30

        return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
    }
}

export const riskManagementService = new RiskManagementService();
