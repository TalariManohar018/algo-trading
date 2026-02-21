// ============================================================
// MTM ENGINE — Real-time Mark-to-Market PnL Calculation
// ============================================================
// Maintains an in-memory snapshot of all open positions with
// live PnL updated on every tick. Persists portfolio snapshots
// every 60 seconds to DB for historical P&L charts.
//
// Tracks:
//   - Unrealised PnL per position
//   - Realised PnL per position (on close)
//   - Portfolio-level total PnL (unrealised + realised)
//   - Daily PnL, drawdown, peak equity
//   - Per-strategy PnL breakdown
//
// Design:
//   All calculations are in-memory O(positions) per tick.
//   Snapshot is persisted async to avoid tick latency.
// ============================================================

import { EventEmitter } from 'events';
import prisma from '../config/database';
import logger from '../utils/logger';

export interface PositionSnapshot {
    positionId: string;
    userId: string;
    strategyId: string | null;
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    stopLoss: number | null;
    takeProfit: number | null;
    unrealisedPnl: number;
    unrealisedPnlPct: number;
    distanceToSl: number | null;   // % to stop loss
    distanceToTp: number | null;   // % to take profit
    openedAt: Date;
}

export interface PortfolioSnapshot {
    userId: string;
    timestamp: Date;
    totalCapital: number;       // initial capital
    availableMargin: number;    // free cash
    usedMargin: number;         // locked in positions
    unrealisedPnl: number;      // open positions
    realisedPnlToday: number;   // closed today
    totalPnlToday: number;      // unrealised + realised
    drawdownPct: number;        // from peak equity today
    peakEquity: number;
    openPositionCount: number;
    positions: PositionSnapshot[];
    byStrategy: Record<string, number>; // strategyId → unrealisedPnl
}

export class MtmEngine extends EventEmitter {
    // In-memory position cache: positionId → snapshot
    private positions = new Map<string, PositionSnapshot>();
    // Latest prices: symbol → price
    private prices = new Map<string, number>();
    // Portfolio state per user
    private portfolios = new Map<string, {
        realisedPnlToday: number;
        peakEquity: number;
        capital: number;
    }>();
    private snapshotTimer: NodeJS.Timeout | null = null;
    private running = false;

    start(initialCapital: number, userId: string): void {
        this.portfolios.set(userId, {
            realisedPnlToday: 0,
            peakEquity: initialCapital,
            capital: initialCapital,
        });
        this.running = true;
        // Persist portfolio snapshot every 60s
        this.snapshotTimer = setInterval(() => this.persistSnapshot(userId), 60_000);
        // Load open positions from DB
        this.loadPositions(userId).catch(err =>
            logger.error(`MTM load positions error: ${err.message}`)
        );
        logger.info(`📈 MTM engine started — capital ₹${initialCapital.toLocaleString()}`);
    }

    stop(): void {
        this.running = false;
        if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    }

    /**
     * Called by market data service on every tick.
     * Updates all positions for that symbol in O(positions).
     */
    onTick(symbol: string, price: number): void {
        this.prices.set(symbol, price);

        let changed = false;
        for (const [id, pos] of this.positions) {
            if (pos.symbol !== symbol) continue;

            const prev = pos.unrealisedPnl;
            pos.currentPrice = price;

            if (pos.side === 'LONG') {
                pos.unrealisedPnl = (price - pos.entryPrice) * pos.quantity;
            } else {
                pos.unrealisedPnl = (pos.entryPrice - price) * pos.quantity;
            }

            // Percentage PnL
            const cost = pos.entryPrice * pos.quantity;
            pos.unrealisedPnlPct = cost > 0 ? (pos.unrealisedPnl / cost) * 100 : 0;

            // Distance to SL/TP
            if (pos.stopLoss) {
                pos.distanceToSl = pos.side === 'LONG'
                    ? ((price - pos.stopLoss) / price) * 100
                    : ((pos.stopLoss - price) / price) * 100;
            }
            if (pos.takeProfit) {
                pos.distanceToTp = pos.side === 'LONG'
                    ? ((pos.takeProfit - price) / price) * 100
                    : ((price - pos.takeProfit) / price) * 100;
            }

            if (Math.abs(pos.unrealisedPnl - prev) > 0.01) changed = true;
        }

        if (changed) {
            this.emit('mtm_update', { symbol, price });
        }
    }

    /**
     * Register a new open position in the MTM engine.
     * Call this immediately after order fill confirmation.
     */
    addPosition(pos: Omit<PositionSnapshot, 'currentPrice' | 'unrealisedPnl' | 'unrealisedPnlPct' | 'distanceToSl' | 'distanceToTp'>): void {
        const price = this.prices.get(pos.symbol) ?? pos.entryPrice;
        const snap: PositionSnapshot = {
            ...pos,
            currentPrice: price,
            unrealisedPnl: 0,
            unrealisedPnlPct: 0,
            distanceToSl: null,
            distanceToTp: null,
        };
        this.positions.set(pos.positionId, snap);
        this.onTick(pos.symbol, price); // force immediate MTM
        logger.debug(`MTM: position added ${pos.symbol} ${pos.side} ${pos.quantity}@₹${pos.entryPrice}`);
    }

    /**
     * Close a position — move unrealised → realised.
     */
    closePosition(positionId: string, exitPrice: number): void {
        const pos = this.positions.get(positionId);
        if (!pos) return;

        let realisedPnl: number;
        if (pos.side === 'LONG') {
            realisedPnl = (exitPrice - pos.entryPrice) * pos.quantity;
        } else {
            realisedPnl = (pos.entryPrice - exitPrice) * pos.quantity;
        }

        // Add to daily realised PnL for the user
        const portfolio = this.portfolios.get(pos.userId);
        if (portfolio) {
            portfolio.realisedPnlToday += realisedPnl;
        }

        this.positions.delete(positionId);

        logger.info(`📊 MTM closed: ${pos.symbol} ${pos.side} realised PnL ₹${realisedPnl.toFixed(2)}`);
        this.emit('position_closed', { positionId, symbol: pos.symbol, realisedPnl, exitPrice });

        // Update position in DB async
        prisma.position.update({
            where: { id: positionId },
            data: {
                currentPrice: exitPrice,
                realizedPnl: realisedPnl,
                unrealizedPnl: 0,
            } as any,
        }).catch(err => logger.warn(`MTM DB update error: ${err.message}`));
    }

    /**
     * Build the full portfolio snapshot for a user.
     */
    getPortfolioSnapshot(userId: string): PortfolioSnapshot {
        const portfolio = this.portfolios.get(userId) ?? {
            realisedPnlToday: 0, peakEquity: 0, capital: 0,
        };

        const userPositions = Array.from(this.positions.values()).filter(p => p.userId === userId);
        const unrealisedPnl = userPositions.reduce((sum, p) => sum + p.unrealisedPnl, 0);
        const totalPnlToday = unrealisedPnl + portfolio.realisedPnlToday;
        const currentEquity = portfolio.capital + totalPnlToday;

        // Update peak equity
        if (currentEquity > portfolio.peakEquity) portfolio.peakEquity = currentEquity;
        const drawdownPct = portfolio.peakEquity > 0
            ? ((portfolio.peakEquity - currentEquity) / portfolio.peakEquity) * 100
            : 0;

        // Per-strategy breakdown
        const byStrategy: Record<string, number> = {};
        for (const pos of userPositions) {
            const key = pos.strategyId ?? 'manual';
            byStrategy[key] = (byStrategy[key] ?? 0) + pos.unrealisedPnl;
        }

        // Estimate used margin (20% intraday margin assumption)
        const usedMargin = userPositions.reduce((sum, p) => sum + (p.entryPrice * p.quantity * 0.2), 0);

        return {
            userId,
            timestamp: new Date(),
            totalCapital: portfolio.capital,
            availableMargin: Math.max(0, portfolio.capital - usedMargin + portfolio.realisedPnlToday),
            usedMargin,
            unrealisedPnl,
            realisedPnlToday: portfolio.realisedPnlToday,
            totalPnlToday,
            drawdownPct,
            peakEquity: portfolio.peakEquity,
            openPositionCount: userPositions.length,
            positions: userPositions,
            byStrategy,
        };
    }

    /**
     * Get a single position snapshot.
     */
    getPosition(positionId: string): PositionSnapshot | null {
        return this.positions.get(positionId) ?? null;
    }

    /**
     * Reset daily realised PnL (called at 9:00 AM IST).
     */
    resetDailyPnl(userId: string): void {
        const p = this.portfolios.get(userId);
        if (p) {
            p.realisedPnlToday = 0;
            p.peakEquity = p.capital;
        }
    }

    // ─── PRIVATE ─────────────────────────────────────────────

    private async loadPositions(userId: string): Promise<void> {
        const openPositions = await prisma.position.findMany({
            where: { userId, status: 'OPEN' },
        }) as any[];

        for (const p of openPositions) {
            this.addPosition({
                positionId: p.id,
                userId: p.userId,
                strategyId: p.strategyId,
                symbol: p.symbol,
                side: p.side === 'LONG' ? 'LONG' : 'SHORT',
                quantity: p.quantity,
                entryPrice: p.entryPrice,
                stopLoss: p.stopLoss,
                takeProfit: p.takeProfit,
                openedAt: p.openedAt,
            });
        }

        logger.info(`MTM: loaded ${openPositions.length} open positions`);
    }

    private async persistSnapshot(userId: string): Promise<void> {
        if (!this.running) return;
        const snap = this.getPortfolioSnapshot(userId);

        try {
            // Update open position MTM in DB
            for (const pos of snap.positions) {
                await prisma.position.update({
                    where: { id: pos.positionId },
                    data: {
                        currentPrice: pos.currentPrice,
                        unrealizedPnl: pos.unrealisedPnl,
                    } as any,
                }).catch(() => { /* position may have closed */ });
            }
        } catch (err: any) {
            logger.debug(`MTM snapshot persist error: ${err.message}`);
        }

        this.emit('portfolio_snapshot', snap);
    }
}

export const mtmEngine = new MtmEngine();
