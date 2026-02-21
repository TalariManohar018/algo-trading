// ============================================================
// STRATEGY CONFLICT RESOLVER
// ============================================================
// When multiple strategies fire signals on the same symbol
// at the same time, conflicts arise:
//
//   Strategy A: BUY NIFTY
//   Strategy B: SELL NIFTY  ← conflict
//
//   Strategy A: BUY NIFTY (open position exists)
//   Strategy B: BUY NIFTY  ← no new entry, but sizing conflict
//
// Resolution rules (in priority order):
//   1. LOCKING: If any strategy has an open position on symbol,
//      no other strategy may take the opposing direction.
//   2. FIRST-WINS: Among same-direction signals, only the first
//      (earliest timestamp, highest confidence) is allowed.
//   3. HEDGE BLOCK: In LIVE_SAFE_MODE, never allow simultaneous
//      LONG + SHORT on the same symbol.
//   4. SIZE AGGREGATION: If allowed, aggregate quantities
//      across same-direction strategies (up to capital limit).
//
// Usage:
//   Before placing any order, resolve via:
//     const decision = await conflictResolver.resolve(signal)
//     if (!decision.allowed) return;
// ============================================================

import prisma from '../config/database';
import logger from '../utils/logger';
import { env } from '../config/env';

export interface StrategySignal {
    strategyId: string;
    strategyName: string;
    userId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    positionSide: 'LONG' | 'SHORT'; // resulting position direction
    quantity: number;
    confidence: number;
    timestamp: Date;
}

export interface ConflictDecision {
    allowed: boolean;
    reason?: string;
    adjustedQuantity?: number;     // may be reduced
    conflictingStrategies?: string[]; // names of blocking strategies
}

export class StrategyConflictResolver {
    // Tracks which strategies have open entries: symbol → positionSide[]
    private symbolLocks = new Map<string, { side: 'LONG' | 'SHORT'; strategyId: string; strategyName: string }[]>();
    // Signals seen this candle: symbol → first signal
    private candleSignals = new Map<string, StrategySignal>();

    /**
     * Main entry point. Call before placing every order.
     */
    async resolve(signal: StrategySignal): Promise<ConflictDecision> {
        // 1. Check DB for live open positions on this symbol
        const openPositions = await prisma.position.findMany({
            where: { symbol: signal.symbol, status: 'OPEN', userId: signal.userId },
            select: { id: true, side: true, strategyId: true },
        }) as any[];

        const existingLongs = openPositions.filter(p => p.side === 'LONG');
        const existingShorts = openPositions.filter(p => p.side === 'SHORT');

        // Rule 1: Hedge block — LIVE_SAFE_MODE never allows opposite simultaneously
        if (env.LIVE_SAFE_MODE) {
            if (signal.positionSide === 'LONG' && existingShorts.length > 0) {
                return this.block(signal, 'LIVE_SAFE_MODE: open SHORT exists on this symbol — BUY blocked', existingShorts.map(p => p.strategyId));
            }
            if (signal.positionSide === 'SHORT' && existingLongs.length > 0) {
                return this.block(signal, 'LIVE_SAFE_MODE: open LONG exists on this symbol — SELL blocked', existingLongs.map(p => p.strategyId));
            }
        }

        // Rule 2: Don't open a 2nd position in same direction from same strategy
        const strategyAlreadyOpen = openPositions.some(p => p.strategyId === signal.strategyId);
        if (strategyAlreadyOpen) {
            return this.block(signal, `Strategy "${signal.strategyName}" already has an open position on ${signal.symbol}`);
        }

        // Rule 3: First-wins within the same candle
        const candleKey = `${signal.userId}:${signal.symbol}`;
        const firstSignal = this.candleSignals.get(candleKey);
        if (firstSignal) {
            if (firstSignal.positionSide !== signal.positionSide) {
                return this.block(
                    signal,
                    `Candle conflict: "${firstSignal.strategyName}" already signaled ${firstSignal.positionSide} on ${signal.symbol} this candle`,
                    [firstSignal.strategyId]
                );
            }
            // Same direction in same candle: allow but reduce to avoid double sizing
            const totalOpenSameDir = existingLongs.length + existingShorts.length;
            if (totalOpenSameDir > 0) {
                // Already have a position in this direction — block additional entry
                return this.block(
                    signal,
                    `Position already open in ${signal.positionSide} direction on ${signal.symbol}`,
                );
            }
        }

        // Lock this candle slot
        this.candleSignals.set(candleKey, signal);

        // Rule 4: Max open positions per symbol (any direction)
        const totalOpen = openPositions.length;
        const MAX_PER_SYMBOL = 1; // conservative for ₹5K capital
        if (totalOpen >= MAX_PER_SYMBOL) {
            return this.block(
                signal,
                `Max ${MAX_PER_SYMBOL} open position(s) per symbol — ${signal.symbol} already has ${totalOpen}`,
            );
        }

        logger.debug(`✅ Conflict check passed: ${signal.strategyName} → ${signal.positionSide} ${signal.symbol}`);
        return { allowed: true, adjustedQuantity: signal.quantity };
    }

    /**
     * Called when a position closes — frees up the symbol slot.
     */
    onPositionClosed(symbol: string, userId: string): void {
        this.candleSignals.delete(`${userId}:${symbol}`);
        logger.debug(`Conflict resolver: position closed — slot freed for ${symbol}`);
    }

    /**
     * Clear candle-level dedup (call on each new candle close).
     */
    clearCandleSignals(): void {
        this.candleSignals.clear();
    }

    // ─── PRIVATE ─────────────────────────────────────────────

    private block(
        signal: StrategySignal,
        reason: string,
        conflictingStrategies?: string[]
    ): ConflictDecision {
        logger.info(`🔀 Conflict block [${signal.strategyName}]: ${reason}`);
        return { allowed: false, reason, conflictingStrategies };
    }
}

export const conflictResolver = new StrategyConflictResolver();
