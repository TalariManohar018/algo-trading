// ============================================================
// BACKTESTING ENGINE
// ============================================================
// Walk-forward simulation using historical candle data.
// Runs strategies against past data to compute performance
// metrics: Win rate, Sharpe, Sortino, Max Drawdown, Profit
// Factor, equity curve.
//
// Important: Uses the SAME indicator calculations and strategy
// logic as the live engine — no separate backtesting math.
// ============================================================

import prisma from '../config/database';
import { strategyRegistry } from '../strategies';
import { Signal, StrategyResult } from '../strategies/base';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface BacktestConfig {
    strategyName: string;
    strategyId: string;
    parameters: Record<string, number>;
    symbol: string;
    timeframe: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    positionSizePercent: number; // % of capital per trade
    slippageBps: number;        // basis points
    commissionBps: number;      // basis points
}

export interface BacktestTrade {
    entryDate: Date;
    exitDate: Date;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
}

export interface BacktestResult {
    config: BacktestConfig;
    trades: BacktestTrade[];
    metrics: BacktestMetrics;
    equityCurve: { date: Date; equity: number }[];
}

export interface BacktestMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    totalReturn: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    averageHoldingPeriod: number; // minutes
    calmarRatio: number;
}

export class BacktestService {
    /**
     * Run a full backtest
     */
    async run(userId: string, config: BacktestConfig): Promise<BacktestResult> {
        // Validate strategy exists
        const strategy = strategyRegistry.getOrThrow(config.strategyName);

        // Validate parameters
        try {
            strategy.validateParameters(config.parameters);
        } catch (e: any) {
            throw new ValidationError(e.message || 'Invalid strategy parameters');
        }

        // Fetch historical candles
        const candles = await prisma.candle.findMany({
            where: {
                symbol: config.symbol,
                timeframe: config.timeframe as any,
                timestamp: {
                    gte: config.startDate,
                    lte: config.endDate,
                },
            },
            orderBy: { timestamp: 'asc' },
        });

        if (candles.length < 50) {
            throw new ValidationError(`Insufficient data: ${candles.length} candles (need at least 50)`);
        }

        logger.info(`Backtesting ${config.strategyName} on ${config.symbol}: ${candles.length} candles`);

        // Walk-forward simulation
        const trades: BacktestTrade[] = [];
        const equityCurve: { date: Date; equity: number }[] = [];
        let capital = config.initialCapital;
        let peakCapital = capital;
        let maxDrawdown = 0;

        let inPosition = false;
        let entryPrice = 0;
        let entryDate = new Date();
        let positionQty = 0;
        let positionSide: 'BUY' | 'SELL' = 'BUY';

        // We need a lookback window for indicators
        const minLookback = 60; // enough for most indicators

        for (let i = minLookback; i < candles.length; i++) {
            const window = candles.slice(0, i + 1);
            const currentCandle = candles[i];

            // Run strategy evaluation
            const candleWindow = window.map((c: any) => ({
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: Number(c.volume),
                timestamp: c.timestamp,
            }));

            let result: StrategyResult;
            try {
                result = strategy.evaluate(
                    candleWindow,
                    { symbol: config.symbol, quantity: 1, parameters: config.parameters },
                    inPosition
                );
            } catch {
                continue; // skip if evaluation fails on this bar
            }

            if (!inPosition && result.signal === Signal.BUY) {
                // ENTER long
                const slippage = currentCandle.close * (config.slippageBps / 10000);
                entryPrice = currentCandle.close + slippage;
                entryDate = currentCandle.timestamp;
                positionSide = 'BUY';
                positionQty = Math.floor((capital * config.positionSizePercent / 100) / entryPrice);

                if (positionQty > 0) {
                    const commission = entryPrice * positionQty * (config.commissionBps / 10000);
                    capital -= commission;
                    inPosition = true;
                }
            } else if (!inPosition && result.signal === Signal.SELL) {
                // ENTER short
                const slippage = currentCandle.close * (config.slippageBps / 10000);
                entryPrice = currentCandle.close - slippage;
                entryDate = currentCandle.timestamp;
                positionSide = 'SELL';
                positionQty = Math.floor((capital * config.positionSizePercent / 100) / entryPrice);

                if (positionQty > 0) {
                    const commission = entryPrice * positionQty * (config.commissionBps / 10000);
                    capital -= commission;
                    inPosition = true;
                }
            } else if (inPosition) {
                // Check stop loss / take profit
                let shouldExit = false;
                let exitPrice = 0;

                if (positionSide === 'BUY') {
                    if (result.stopLoss && currentCandle.low <= result.stopLoss) {
                        exitPrice = result.stopLoss;
                        shouldExit = true;
                    } else if (result.takeProfit && currentCandle.high >= result.takeProfit) {
                        exitPrice = result.takeProfit;
                        shouldExit = true;
                    } else if (result.signal === Signal.SELL) {
                        exitPrice = currentCandle.close;
                        shouldExit = true;
                    }
                } else {
                    if (result.stopLoss && currentCandle.high >= result.stopLoss) {
                        exitPrice = result.stopLoss;
                        shouldExit = true;
                    } else if (result.takeProfit && currentCandle.low <= result.takeProfit) {
                        exitPrice = result.takeProfit;
                        shouldExit = true;
                    } else if (result.signal === Signal.BUY) {
                        exitPrice = currentCandle.close;
                        shouldExit = true;
                    }
                }

                if (shouldExit) {
                    const slippage = exitPrice * (config.slippageBps / 10000);
                    if (positionSide === 'BUY') {
                        exitPrice -= slippage;
                    } else {
                        exitPrice += slippage;
                    }

                    const pnl = positionSide === 'BUY'
                        ? (exitPrice - entryPrice) * positionQty
                        : (entryPrice - exitPrice) * positionQty;
                    const commission = exitPrice * positionQty * (config.commissionBps / 10000);
                    capital += pnl - commission;

                    trades.push({
                        entryDate,
                        exitDate: currentCandle.timestamp,
                        side: positionSide,
                        entryPrice,
                        exitPrice,
                        quantity: positionQty,
                        pnl: pnl - commission,
                        pnlPercent: ((pnl - commission) / (entryPrice * positionQty)) * 100,
                    });

                    inPosition = false;
                }
            }

            // Track equity
            let unrealizedPnl = 0;
            if (inPosition) {
                unrealizedPnl = positionSide === 'BUY'
                    ? (currentCandle.close - entryPrice) * positionQty
                    : (entryPrice - currentCandle.close) * positionQty;
            }

            const equity = capital + unrealizedPnl;
            equityCurve.push({ date: currentCandle.timestamp, equity });

            // Drawdown tracking
            if (equity > peakCapital) peakCapital = equity;
            const drawdown = peakCapital - equity;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        // Compute metrics
        const metrics = this.computeMetrics(trades, config.initialCapital, capital, maxDrawdown, peakCapital);

        // Save backtest result to DB
        await prisma.backtest.create({
            data: {
                userId,
                strategyId: config.strategyId,
                symbol: config.symbol,
                startDate: config.startDate,
                endDate: config.endDate,
                initialCapital: config.initialCapital,
                finalCapital: capital,
                totalPnl: metrics.totalPnl,
                totalTrades: metrics.totalTrades,
                winningTrades: metrics.winningTrades,
                losingTrades: metrics.losingTrades,
                winRate: metrics.winRate,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownPct: metrics.maxDrawdownPercent,
                sharpeRatio: metrics.sharpeRatio,
                sortinoRatio: metrics.sortinoRatio,
                profitFactor: metrics.profitFactor,
                avgWin: metrics.averageWin,
                avgLoss: metrics.averageLoss,
                equityCurve: equityCurve.map(e => ({ d: e.date.toISOString(), e: e.equity })),
                trades: trades.map(t => ({
                    entry: t.entryDate.toISOString(),
                    exit: t.exitDate.toISOString(),
                    side: t.side,
                    ep: t.entryPrice,
                    xp: t.exitPrice,
                    qty: t.quantity,
                    pnl: t.pnl,
                })),
                status: 'completed',
            },
        });

        return { config, trades, metrics, equityCurve };
    }

    /**
     * Compute all performance metrics from trade list
     */
    private computeMetrics(
        trades: BacktestTrade[],
        initialCapital: number,
        finalCapital: number,
        maxDrawdown: number,
        peakCapital: number
    ): BacktestMetrics {
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl <= 0);
        const totalPnl = finalCapital - initialCapital;
        const totalReturn = (totalPnl / initialCapital) * 100;

        // Holding periods (in minutes)
        const holdingPeriods = trades.map(t =>
            (t.exitDate.getTime() - t.entryDate.getTime()) / 60000
        );

        // Sharpe Ratio (annualized, assuming 252 trading days)
        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const stdReturn = Math.sqrt(
            returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length || 1)
        );
        const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

        // Sortino Ratio (downside deviation only)
        const negativeReturns = returns.filter(r => r < 0);
        const downsideDev = Math.sqrt(
            negativeReturns.reduce((sum, r) => sum + r ** 2, 0) / (negativeReturns.length || 1)
        );
        const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

        // Profit Factor
        const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        // Max drawdown percent
        const maxDrawdownPercent = peakCapital > 0 ? (maxDrawdown / peakCapital) * 100 : 0;

        // Calmar ratio
        const calmarRatio = maxDrawdownPercent > 0 ? totalReturn / maxDrawdownPercent : 0;

        return {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
            totalPnl,
            totalReturn,
            maxDrawdown,
            maxDrawdownPercent,
            sharpeRatio: parseFloat(sharpeRatio.toFixed(3)),
            sortinoRatio: parseFloat(sortinoRatio.toFixed(3)),
            profitFactor: parseFloat(profitFactor.toFixed(3)),
            averageWin: wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0,
            averageLoss: losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0,
            largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
            largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0,
            averageHoldingPeriod: holdingPeriods.length > 0
                ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length
                : 0,
            calmarRatio: parseFloat(calmarRatio.toFixed(3)),
        };
    }

    /**
     * Get backtest history for a user
     */
    async getHistory(userId: string, limit = 20) {
        return prisma.backtest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                strategyId: true,
                symbol: true,
                startDate: true,
                endDate: true,
                totalPnl: true,
                totalTrades: true,
                winRate: true,
                maxDrawdown: true,
                sharpeRatio: true,
                profitFactor: true,
                createdAt: true,
            },
        });
    }

    /**
     * Get a single backtest result by ID
     */
    async getById(userId: string, backtestId: string) {
        const result = await prisma.backtest.findUnique({ where: { id: backtestId } });
        if (!result || result.userId !== userId) {
            throw new NotFoundError('Backtest not found');
        }
        return result;
    }
}

export const backtestService = new BacktestService();
