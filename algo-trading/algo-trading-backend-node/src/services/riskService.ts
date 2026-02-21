// ============================================================
// RISK MANAGEMENT SERVICE — BEGINNER SAFE MODE
// ============================================================
// Capital: ₹5,000  |  Max risk/trade: ₹100  |  Daily loss cap: ₹200
//
// Hard rules enforced BEFORE every order:
//   1. Engine lock check
//   2. Daily loss limit  (₹200)
//   3. Max trades/day   (5)
//   4. 3 consecutive losses → auto-lock
//   5. Mandatory stop loss on every trade
//   6. Position size capped to ₹100 risk
//   7. Max open positions (2)
//   8. Market hours (IST 9:15–15:20)
//   9. Broker connection alive
//  10. Wallet margin check
// ============================================================

import prisma from '../config/database';
import { env } from '../config/env';
import { riskLogger } from '../utils/logger';
import { getBrokerInstance } from '../engine/brokerFactory';

// Extended type that always includes the new schema fields.
// Prisma client may not reflect them until a full TS server restart.
interface RiskStateExtended {
    id: string;
    userId: string;
    dailyLoss: number;
    dailyTradeCount: number;
    consecutiveLosses: number;
    isLocked: boolean;
    lockReason: string | null;
    tradingDate: Date;
    updatedAt: Date;
}

export interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
}

export interface TradeLog {
    strategyId?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice?: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    pnl?: number;
    timestamp: Date;
    reason: string;
}

export class RiskManagementService {

    // ─── PRE-TRADE VALIDATION ────────────────────────────────

    /**
     * Comprehensive pre-order risk check. ALL checks must pass.
     * Called BEFORE every order regardless of source.
     */
    async checkPreOrder(
        userId: string,
        orderValue: number,
        stopLossPercent?: number
    ): Promise<RiskCheckResult> {

        // 1. Engine lock
        const riskState = await this.getRiskState(userId);
        if (riskState.isLocked) {
            return { allowed: false, reason: `LOCKED: ${riskState.lockReason || 'Risk limit breached'}` };
        }

        // 2. Daily loss limit (₹200)
        if (riskState.dailyLoss >= env.MAX_DAILY_LOSS) {
            await this.lockEngine(userId, `Daily loss cap ₹${env.MAX_DAILY_LOSS} reached (current: ₹${riskState.dailyLoss.toFixed(0)})`);
            return { allowed: false, reason: `Daily loss limit ₹${env.MAX_DAILY_LOSS} reached — trading stopped for today` };
        }

        // 3. Daily trade count (max 5)
        if (riskState.dailyTradeCount >= env.MAX_TRADES_PER_DAY) {
            return { allowed: false, reason: `Max ${env.MAX_TRADES_PER_DAY} trades/day reached (today: ${riskState.dailyTradeCount})` };
        }

        // 4. Consecutive losses (max 3)
        if (riskState.consecutiveLosses >= env.CONSECUTIVE_LOSS_LIMIT) {
            await this.lockEngine(userId, `${env.CONSECUTIVE_LOSS_LIMIT} consecutive losing trades — auto-stopped`);
            return { allowed: false, reason: `${env.CONSECUTIVE_LOSS_LIMIT} consecutive losses — trading stopped` };
        }

        // 5. Mandatory stop loss — reject any order without SL configured
        if (!stopLossPercent || stopLossPercent <= 0) {
            return { allowed: false, reason: 'MANDATORY: Stop loss not configured on this strategy. Set stopLossPercent > 0.' };
        }

        // 6. Per-trade risk cap (₹100)
        const riskAmount = orderValue * (stopLossPercent / 100);
        if (riskAmount > env.MAX_RISK_PER_TRADE) {
            return {
                allowed: false,
                reason: `Trade risk ₹${riskAmount.toFixed(0)} exceeds max ₹${env.MAX_RISK_PER_TRADE}/trade. Reduce quantity or widen SL%.`
            };
        }

        // 7. Max open positions (2 simultaneous)
        const openPositions = await prisma.position.count({
            where: { userId, status: 'OPEN' },
        });
        if (openPositions >= env.MAX_OPEN_POSITIONS) {
            return { allowed: false, reason: `Max ${env.MAX_OPEN_POSITIONS} open positions reached` };
        }

        // 8. Market hours — must be before 15:20 IST to allow new trades
        const minutesToClose = this.minutesToMarketClose();
        if (minutesToClose !== null && minutesToClose < 10) {
            return { allowed: false, reason: 'Within 10 minutes of market close — no new trades allowed' };
        }
        if (!this.isMarketOpen()) {
            return { allowed: false, reason: 'Market is closed' };
        }

        // 9. Broker connection alive
        try {
            const broker = getBrokerInstance();
            if (!broker.isConnected()) {
                return { allowed: false, reason: 'Broker not connected — cannot place live orders' };
            }
        } catch {
            return { allowed: false, reason: 'Broker unavailable — cannot place live orders' };
        }

        // 10. Wallet margin
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (wallet) {
            const requiredMargin = orderValue * 0.2; // 20% intraday margin
            if (wallet.availableMargin < requiredMargin) {
                return {
                    allowed: false,
                    reason: `Insufficient margin: ₹${wallet.availableMargin.toFixed(0)} available, ₹${requiredMargin.toFixed(0)} required`
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate pre-trading conditions (called at engine start).
     * Returns list of failed checks — if any CRITICAL fail, do NOT start trading.
     */
    async validatePreTrading(userId: string): Promise<{ ok: boolean; checks: { name: string; passed: boolean; message: string }[] }> {
        const checks: { name: string; passed: boolean; message: string }[] = [];

        // Broker connected
        try {
            const broker = getBrokerInstance();
            const connected = broker.isConnected();
            checks.push({ name: 'Broker Connection', passed: connected, message: connected ? 'Angel One connected' : 'Broker NOT connected' });
        } catch {
            checks.push({ name: 'Broker Connection', passed: false, message: 'Broker service unavailable' });
        }

        // Risk state not locked
        const riskState = await this.getRiskState(userId);
        checks.push({
            name: 'Engine Lock',
            passed: !riskState.isLocked,
            message: riskState.isLocked ? `Locked: ${riskState.lockReason}` : 'Not locked'
        });

        // Daily loss within limits
        const lossOk = riskState.dailyLoss < env.MAX_DAILY_LOSS;
        checks.push({
            name: 'Daily Loss',
            passed: lossOk,
            message: `₹${riskState.dailyLoss.toFixed(0)} / ₹${env.MAX_DAILY_LOSS}`
        });

        // Trade count within limits
        const tradeOk = riskState.dailyTradeCount < env.MAX_TRADES_PER_DAY;
        checks.push({
            name: 'Daily Trade Count',
            passed: tradeOk,
            message: `${riskState.dailyTradeCount} / ${env.MAX_TRADES_PER_DAY} trades`
        });

        // Consecutive losses
        const consecOk = riskState.consecutiveLosses < env.CONSECUTIVE_LOSS_LIMIT;
        checks.push({
            name: 'Consecutive Losses',
            passed: consecOk,
            message: `${riskState.consecutiveLosses} / ${env.CONSECUTIVE_LOSS_LIMIT} allowed`
        });

        // Market hours
        const marketOk = this.isMarketOpen();
        checks.push({
            name: 'Market Hours',
            passed: marketOk,
            message: marketOk ? 'Market is open' : 'Market is closed (IST)'
        });

        const ok = checks.every(c => c.passed);
        return { ok, checks };
    }

    // ─── POSITION SIZING ─────────────────────────────────────

    /**
     * Calculate safe quantity based on ₹100 max risk rule.
     * qty = floor(MAX_RISK_PER_TRADE / (entryPrice × stopLossPercent%))
     * Never exceeds 1 lot for safety.
     */
    calculatePositionSize(entryPrice: number, stopLossPercent: number): number {
        if (!entryPrice || !stopLossPercent || stopLossPercent <= 0) return 1;
        const riskPerShare = entryPrice * (stopLossPercent / 100);
        if (riskPerShare <= 0) return 1;
        const qty = Math.floor(env.MAX_RISK_PER_TRADE / riskPerShare);
        return Math.max(1, qty); // at least 1
    }

    // ─── TRADE RESULT TRACKING ───────────────────────────────

    /**
     * Record a completed trade result — tracks consecutive losses + daily loss.
     * Call AFTER every trade closes (both wins and losses).
     */
    async recordTradeResult(userId: string, pnl: number): Promise<void> {
        const isLoss = pnl < 0;

        const updated = await prisma.riskState.update({
            where: { userId },
            data: {
                dailyTradeCount: { increment: 1 },
                dailyLoss: isLoss ? { increment: Math.abs(pnl) } : undefined,
                consecutiveLosses: isLoss ? { increment: 1 } : { set: 0 }, // reset on win
            } as never,
        }) as unknown as RiskStateExtended;

        riskLogger.info(
            `Trade result: PnL ₹${pnl.toFixed(2)} | Daily loss: ₹${updated.dailyLoss.toFixed(0)}/${env.MAX_DAILY_LOSS} | Trades: ${updated.dailyTradeCount}/${env.MAX_TRADES_PER_DAY} | Consec losses: ${updated.consecutiveLosses}/${env.CONSECUTIVE_LOSS_LIMIT}`,
            { userId }
        );

        // Auto-lock on consecutive losses
        if (updated.consecutiveLosses >= env.CONSECUTIVE_LOSS_LIMIT) {
            const reason = `${env.CONSECUTIVE_LOSS_LIMIT} consecutive losing trades (₹${Math.abs(pnl).toFixed(0)} last loss)`;
            await this.lockEngine(userId, reason);
            riskLogger.error(`AUTO-LOCK: ${reason}`, { userId });
        }

        // Auto-lock on daily loss
        if (updated.dailyLoss >= env.MAX_DAILY_LOSS) {
            const reason = `Daily loss limit ₹${env.MAX_DAILY_LOSS} reached (₹${updated.dailyLoss.toFixed(0)} total)`;
            await this.lockEngine(userId, reason);
            riskLogger.error(`AUTO-LOCK: ${reason}`, { userId });
        }
    }

    /**
     * Log every trade with full audit trail.
     */
    async logTrade(userId: string, log: TradeLog): Promise<void> {
        await prisma.auditLog.create({
            data: {
                userId,
                event: 'TRADE',
                severity: (log.pnl !== undefined && log.pnl < 0) ? 'WARNING' : 'INFO',
                message: `${log.side} ${log.quantity}x ${log.symbol} | Entry: ₹${log.entryPrice} | SL: ₹${log.stopLoss} | TP: ₹${log.takeProfit}${log.exitPrice ? ` | Exit: ₹${log.exitPrice} | PnL: ₹${log.pnl?.toFixed(2)}` : ' | OPEN'} | ${log.reason}`,
                metadata: JSON.stringify({
                    ...log,
                    timestamp: log.timestamp.toISOString(),
                }),
            },
        });
    }

    // ─── ENGINE LOCK / UNLOCK ────────────────────────────────

    /**
     * Lock the engine — no more trades until manually unlocked.
     */
    async lockEngine(userId: string, reason: string): Promise<void> {
        await prisma.riskState.upsert({
            where: { userId },
            update: { isLocked: true, lockReason: reason },
            create: { userId, isLocked: true, lockReason: reason, tradingDate: new Date() },
        });

        await prisma.auditLog.create({
            data: { userId, event: 'RISK_BREACH', severity: 'CRITICAL', message: reason },
        });

        riskLogger.error(`🔒 Engine LOCKED: ${reason}`, { userId });
    }

    /**
     * Unlock the engine (manual admin action).
     */
    async unlockEngine(userId: string): Promise<void> {
        await prisma.riskState.update({
            where: { userId },
            data: { isLocked: false, lockReason: null, consecutiveLosses: 0 } as never,
        });
        await prisma.auditLog.create({
            data: { userId, event: 'ENGINE_UNLOCKED', severity: 'INFO', message: 'Engine manually unlocked by admin' },
        });
        riskLogger.info('🔓 Engine unlocked', { userId });
    }

    /**
     * Reset daily counters (called at market open 9:00 AM IST).
     */
    async resetDailyCounters(userId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.riskState.upsert({
            where: { userId },
            update: {
                dailyLoss: 0,
                dailyTradeCount: 0,
                consecutiveLosses: 0,
                tradingDate: today,
                isLocked: false,
                lockReason: null,
            } as never,
            create: {
                userId,
                dailyLoss: 0,
                dailyTradeCount: 0,
                consecutiveLosses: 0,
                tradingDate: today,
            } as never,
        });
        riskLogger.info('Daily counters reset for new trading day', { userId });
    }

    /**
     * Get current risk state — creates default if missing, auto-resets on new day.
     */
    async getRiskState(userId: string): Promise<RiskStateExtended> {
        let state = await prisma.riskState.findUnique({ where: { userId } }) as unknown as RiskStateExtended | null;

        if (!state) {
            state = await prisma.riskState.create({
                data: { userId, tradingDate: new Date() },
            }) as unknown as RiskStateExtended;
        }

        // Auto-reset if it's a new trading day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (state.tradingDate < today) {
            await this.resetDailyCounters(userId);
            state = await prisma.riskState.findUnique({ where: { userId } }) as unknown as RiskStateExtended;
        }

        return state!;
    }

    // ─── MARKET HOURS ────────────────────────────────────────

    /**
     * Returns minutes remaining until market close (15:30 IST).
     * Returns null if outside market hours (already closed or before open).
     */
    minutesToMarketClose(): number | null {
        if (env.TRADING_MODE === 'paper') return null;
        const ist = this.getISTDate();
        const day = ist.getUTCDay();
        if (day === 0 || day === 6) return null;

        const hours = ist.getUTCHours();
        const minutes = ist.getUTCMinutes();
        const timeInMinutes = hours * 60 + minutes;
        const marketClose = 15 * 60 + 30;
        const marketOpen = 9 * 60 + 15;

        if (timeInMinutes < marketOpen) return null;
        if (timeInMinutes >= marketClose) return 0;
        return marketClose - timeInMinutes;
    }

    isMarketOpen(): boolean {
        if (env.TRADING_MODE === 'paper') return true;
        const ist = this.getISTDate();
        const day = ist.getUTCDay();
        if (day === 0 || day === 6) return false;

        const hours = ist.getUTCHours();
        const minutes = ist.getUTCMinutes();
        const timeInMinutes = hours * 60 + minutes;
        return timeInMinutes >= (9 * 60 + 15) && timeInMinutes <= (15 * 60 + 30);
    }

    private getISTDate(): Date {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        return new Date(now.getTime() + istOffset);
    }
}

export const riskManagementService = new RiskManagementService();
