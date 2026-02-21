// ============================================================
// SLIPPAGE & LATENCY MODEL
// ============================================================
// Models expected price impact of orders before placement.
// Used for:
//   1. Risk-adjusted PnL estimation
//   2. Deciding if a signal is still viable after latency
//   3. Logging actual vs expected slippage for tuning
//
// Slippage components:
//   a) Bid-ask spread cost (half-spread per side)
//   b) Market impact (price moves due to our order size)
//   c) Timing slippage (tick movement during order routing)
//
// Latency budget:
//   Angel One API round-trip target: < 500ms
//   If actual latency > budget, signal is stale — skip order
// ============================================================

import logger from '../utils/logger';
import prisma from '../config/database';

export interface SlippageEstimate {
    symbol: string;
    side: 'BUY' | 'SELL';
    expectedEntry: number;         // price BEFORE slippage
    adjustedEntry: number;         // price AFTER slippage
    slippageAmount: number;        // ₹ per share
    slippagePct: number;           // %
    slippageTotalCost: number;     // slippageAmount × quantity
    isViable: boolean;             // true if slippage within tolerance
    rejectReason?: string;
}

export interface LatencyStats {
    symbol: string;
    signalTime: Date;
    orderSentTime: Date;
    orderAckTime?: Date;
    fillTime?: Date;
    signalToOrderMs: number;    // strategy eval → placeOrder call
    orderToAckMs?: number;      // placeOrder call → broker ack
    orderToFillMs?: number;     // placeOrder call → FILLED status
}

// Slippage parameters by symbol type
interface SlippageConfig {
    halfSpreadPct: number;       // half bid-ask spread (%)
    marketImpactPct: number;     // price impact per ₹1L order value (%)
    maxTolerancePct: number;     // max acceptable slippage (%)
}

const SYMBOL_CONFIGS: Record<string, SlippageConfig> = {
    // Large caps / indices — very liquid
    NIFTY:     { halfSpreadPct: 0.01, marketImpactPct: 0.002, maxTolerancePct: 0.10 },
    BANKNIFTY: { halfSpreadPct: 0.02, marketImpactPct: 0.003, maxTolerancePct: 0.15 },
    RELIANCE:  { halfSpreadPct: 0.03, marketImpactPct: 0.005, maxTolerancePct: 0.15 },
    TCS:       { halfSpreadPct: 0.03, marketImpactPct: 0.005, maxTolerancePct: 0.15 },
    INFY:      { halfSpreadPct: 0.03, marketImpactPct: 0.005, maxTolerancePct: 0.15 },
    HDFCBANK:  { halfSpreadPct: 0.03, marketImpactPct: 0.005, maxTolerancePct: 0.15 },
    // Default for unknown symbols (mid-cap assumption)
    DEFAULT:   { halfSpreadPct: 0.08, marketImpactPct: 0.015, maxTolerancePct: 0.30 },
};

// Max age of a signal before we consider it stale
const MAX_SIGNAL_AGE_MS = 3_000; // 3 seconds

export class SlippageModel {
    // Tracks signal timestamps per strategy for latency measurement
    private signalTimes = new Map<string, Date>(); // strategyId → last signal time
    // Rolling latency stats (last 100 orders)
    private latencyHistory: LatencyStats[] = [];
    private readonly MAX_HISTORY = 100;

    /**
     * Estimate slippage for a given order before placement.
     * Returns adjustedEntry price and viability decision.
     */
    estimate(
        symbol: string,
        side: 'BUY' | 'SELL',
        price: number,
        quantity: number,
        signalTime?: Date
    ): SlippageEstimate {
        const config = SYMBOL_CONFIGS[symbol.toUpperCase()] ?? SYMBOL_CONFIGS.DEFAULT;

        // 1. Spread cost (always paid on market orders)
        const spreadCost = price * (config.halfSpreadPct / 100);

        // 2. Market impact based on order value
        const orderValue = price * quantity;
        const orderValueLakhs = orderValue / 100_000;
        const impactCost = price * (config.marketImpactPct / 100) * orderValueLakhs;

        // 3. Timing slippage (if we know signal age)
        let timingSlippage = 0;
        if (signalTime) {
            const ageMs = Date.now() - signalTime.getTime();
            if (ageMs > MAX_SIGNAL_AGE_MS) {
                // Signal is stale — reject entirely
                return {
                    symbol, side,
                    expectedEntry: price,
                    adjustedEntry: price,
                    slippageAmount: 0,
                    slippagePct: 0,
                    slippageTotalCost: 0,
                    isViable: false,
                    rejectReason: `Signal stale: ${ageMs}ms old (max ${MAX_SIGNAL_AGE_MS}ms). Market may have moved.`,
                };
            }
            // Small timing component: assume 0.001% per 100ms of age
            timingSlippage = price * 0.00001 * (ageMs / 100);
        }

        const totalSlippagePerShare = spreadCost + impactCost + timingSlippage;
        const slippagePct = (totalSlippagePerShare / price) * 100;
        const adjustedEntry = side === 'BUY'
            ? price + totalSlippagePerShare   // we pay more when buying
            : price - totalSlippagePerShare;  // we receive less when selling

        const isViable = slippagePct <= config.maxTolerancePct;

        if (!isViable) {
            logger.warn(`⚠️  Slippage too high: ${symbol} ${side} — ${slippagePct.toFixed(3)}% > max ${config.maxTolerancePct}%`);
        }

        return {
            symbol, side,
            expectedEntry: price,
            adjustedEntry: Math.round(adjustedEntry * 100) / 100,
            slippageAmount: Math.round(totalSlippagePerShare * 100) / 100,
            slippagePct: Math.round(slippagePct * 1000) / 1000,
            slippageTotalCost: Math.round(totalSlippagePerShare * quantity * 100) / 100,
            isViable,
        };
    }

    /**
     * Record signal time per strategy (call when signal is generated).
     */
    recordSignalTime(strategyId: string): void {
        this.signalTimes.set(strategyId, new Date());
    }

    /**
     * Get signal age for a strategy in milliseconds.
     */
    getSignalAgeMs(strategyId: string): number {
        const t = this.signalTimes.get(strategyId);
        return t ? Date.now() - t.getTime() : 0;
    }

    /**
     * Record actual fill vs expected (call after order fills).
     * Used to measure real-world slippage for model calibration.
     */
    async recordActualSlippage(
        userId: string,
        symbol: string,
        side: 'BUY' | 'SELL',
        expectedPrice: number,
        actualFillPrice: number,
        quantity: number,
        stats: Partial<LatencyStats>
    ): Promise<void> {
        const actualSlippage = side === 'BUY'
            ? actualFillPrice - expectedPrice
            : expectedPrice - actualFillPrice;
        const actualSlippagePct = (actualSlippage / expectedPrice) * 100;
        const slippageCost = actualSlippage * quantity;

        logger.info(`📏 Slippage: ${symbol} ${side} expected ₹${expectedPrice} actual ₹${actualFillPrice} | slippage ₹${actualSlippage.toFixed(2)} (${actualSlippagePct.toFixed(3)}%) | cost ₹${slippageCost.toFixed(2)}`);

        // Add to latency history
        if (stats.signalTime && stats.orderSentTime) {
            const latRecord: LatencyStats = {
                symbol,
                signalTime: stats.signalTime,
                orderSentTime: stats.orderSentTime,
                orderAckTime: stats.orderAckTime,
                fillTime: stats.fillTime,
                signalToOrderMs: stats.orderSentTime.getTime() - stats.signalTime.getTime(),
                orderToAckMs: stats.orderAckTime
                    ? stats.orderAckTime.getTime() - stats.orderSentTime.getTime()
                    : undefined,
                orderToFillMs: stats.fillTime
                    ? stats.fillTime.getTime() - stats.orderSentTime.getTime()
                    : undefined,
            };

            this.latencyHistory.push(latRecord);
            if (this.latencyHistory.length > this.MAX_HISTORY) this.latencyHistory.shift();
        }

        // Persist to audit log
        try {
            await prisma.auditLog.create({
                data: {
                    userId,
                    event: 'SLIPPAGE_RECORD',
                    severity: Math.abs(actualSlippagePct) > 0.5 ? 'WARNING' : 'INFO',
                    message: `${symbol} ${side}: expected ₹${expectedPrice} actual ₹${actualFillPrice} slippage ₹${actualSlippage.toFixed(2)} (${actualSlippagePct.toFixed(3)}%)`,
                    metadata: JSON.stringify({
                        symbol, side, expectedPrice, actualFillPrice,
                        actualSlippage, actualSlippagePct, slippageCost, quantity,
                        signalToOrderMs: stats.orderSentTime
                            ? stats.orderSentTime.getTime() - (stats.signalTime?.getTime() ?? 0)
                            : null,
                    }),
                },
            });
        } catch { /* non-fatal */ }
    }

    /**
     * Get latency summary statistics.
     */
    getLatencyStats(): {
        avgSignalToOrderMs: number;
        avgOrderToAckMs: number;
        p95SignalToOrderMs: number;
        totalSamples: number;
    } {
        if (this.latencyHistory.length === 0) {
            return { avgSignalToOrderMs: 0, avgOrderToAckMs: 0, p95SignalToOrderMs: 0, totalSamples: 0 };
        }

        const signalToOrders = this.latencyHistory.map(r => r.signalToOrderMs).sort((a, b) => a - b);
        const ackLatencies = this.latencyHistory
            .filter(r => r.orderToAckMs !== undefined)
            .map(r => r.orderToAckMs!);

        const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        const p95 = (arr: number[]) => arr.length ? arr[Math.floor(arr.length * 0.95)] : 0;

        return {
            avgSignalToOrderMs: Math.round(avg(signalToOrders)),
            avgOrderToAckMs: Math.round(avg(ackLatencies)),
            p95SignalToOrderMs: Math.round(p95(signalToOrders)),
            totalSamples: this.latencyHistory.length,
        };
    }
}

export const slippageModel = new SlippageModel();
