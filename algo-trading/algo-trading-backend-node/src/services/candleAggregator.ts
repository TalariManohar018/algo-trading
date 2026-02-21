// ============================================================
// CANDLE AGGREGATOR — Multi-Timeframe Tick → OHLCV Builder
// ============================================================
// Builds 1m, 5m, 15m candles from raw ticks in memory.
// Persists to DB on candle close. Emits 'candle_close' events
// consumed by the execution engine for strategy evaluation.
//
// Architecture:
//   Tick → update all TF builders → on minute boundary emit
//                                   1m always
//                                   5m every 5th minute
//                                  15m every 15th minute
// ============================================================

import { EventEmitter } from 'events';
import prisma from '../config/database';
import logger from '../utils/logger';
import { CandleInput } from '../strategies/indicators';

export type Timeframe = 'ONE_MINUTE' | 'FIVE_MINUTE' | 'FIFTEEN_MINUTE';

export interface Tick {
    symbol: string;
    exchange: string;
    lastPrice: number;
    volume: number;
    timestamp: Date;
    bidPrice?: number;
    askPrice?: number;
}

interface CandleBuilder {
    symbol: string;
    timeframe: Timeframe;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    tickCount: number;
    startTime: Date;
    endTime: Date;
    vwapNumerator: number; // sum(price * volume) for VWAP
}

// Timeframe → minutes granularity
const TF_MINUTES: Record<Timeframe, number> = {
    ONE_MINUTE: 1,
    FIVE_MINUTE: 5,
    FIFTEEN_MINUTE: 15,
};

const SUPPORTED_TIMEFRAMES: Timeframe[] = ['ONE_MINUTE', 'FIVE_MINUTE', 'FIFTEEN_MINUTE'];

export class CandleAggregator extends EventEmitter {
    // Key = `${symbol}:${timeframe}`
    private builders = new Map<string, CandleBuilder>();
    // Completed candles buffer (last N per symbol:tf)
    private completedCandles = new Map<string, CandleInput[]>();
    private readonly BUFFER_SIZE = 200;
    // Track previous tick volume per symbol for delta calculation
    private prevVolume = new Map<string, number>();

    /**
     * Feed a new tick into all timeframe builders for its symbol.
     * This is the ONLY public ingestion point.
     */
    processTick(tick: Tick): void {
        const volumeDelta = this.computeVolumeDelta(tick);

        for (const tf of SUPPORTED_TIMEFRAMES) {
            this.updateBuilder(tick, tf, volumeDelta);
        }
    }

    /**
     * Must be called on exact minute boundaries (from a setInterval).
     * Closes candles whose timeframe boundary has been reached.
     */
    async flushCompletedCandles(now: Date = new Date()): Promise<void> {
        const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();

        for (const tf of SUPPORTED_TIMEFRAMES) {
            const tfMinutes = TF_MINUTES[tf];
            // Close candle if current minute is divisible by timeframe width
            if (minuteOfDay % tfMinutes === 0) {
                await this.closeCandles(tf, now);
            }
        }
    }

    /**
     * Get in-memory buffer of completed candles (for strategy use).
     */
    getCandles(symbol: string, timeframe: Timeframe, limit = 100): CandleInput[] {
        const key = `${symbol}:${timeframe}`;
        const buf = this.completedCandles.get(key) || [];
        return buf.slice(-limit);
    }

    /**
     * Get current (incomplete) candle for a symbol/timeframe.
     */
    getCurrentCandle(symbol: string, timeframe: Timeframe): CandleInput | null {
        const builder = this.builders.get(`${symbol}:${timeframe}`);
        if (!builder) return null;
        return {
            open: builder.open,
            high: builder.high,
            low: builder.low,
            close: builder.close,
            volume: builder.volume,
            timestamp: builder.startTime,
        };
    }

    // ─── PRIVATE ─────────────────────────────────────────────

    private computeVolumeDelta(tick: Tick): number {
        const prev = this.prevVolume.get(tick.symbol) || 0;
        const delta = tick.volume > prev ? tick.volume - prev : tick.volume;
        this.prevVolume.set(tick.symbol, tick.volume);
        return Math.max(0, delta);
    }

    private updateBuilder(tick: Tick, tf: Timeframe, volumeDelta: number): void {
        const key = `${tick.symbol}:${tf}`;
        let b = this.builders.get(key);

        if (!b) {
            b = this.createBuilder(tick.symbol, tf, tick.lastPrice, tick.timestamp);
            this.builders.set(key, b);
        }

        // Update OHLCV
        b.high = Math.max(b.high, tick.lastPrice);
        b.low = Math.min(b.low, tick.lastPrice);
        b.close = tick.lastPrice;
        b.volume += volumeDelta;
        b.tickCount++;
        b.vwapNumerator += tick.lastPrice * volumeDelta;
    }

    private createBuilder(
        symbol: string,
        tf: Timeframe,
        price: number,
        now: Date
    ): CandleBuilder {
        const startTime = this.alignToTimeframe(now, TF_MINUTES[tf]);
        const endTime = new Date(startTime.getTime() + TF_MINUTES[tf] * 60_000);
        return {
            symbol, timeframe: tf,
            open: price, high: price, low: price, close: price,
            volume: 0, tickCount: 0, vwapNumerator: 0,
            startTime, endTime,
        };
    }

    private alignToTimeframe(date: Date, tfMinutes: number): Date {
        const ms = date.getTime();
        const periodMs = tfMinutes * 60_000;
        return new Date(Math.floor(ms / periodMs) * periodMs);
    }

    private async closeCandles(tf: Timeframe, now: Date): Promise<void> {
        // Collect all builders of this timeframe to close
        const toClose: CandleBuilder[] = [];
        for (const [key, b] of this.builders) {
            if (b.timeframe === tf) toClose.push(b);
        }

        for (const b of toClose) {
            if (b.tickCount === 0) continue; // no data this period

            const vwap = b.volume > 0 ? b.vwapNumerator / b.volume : b.close;
            const candle: CandleInput & { vwap?: number; tickCount?: number } = {
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: Math.floor(b.volume),
                timestamp: b.startTime,
                vwap: Math.round(vwap * 100) / 100,
                tickCount: b.tickCount,
            };

            // Add to in-memory buffer
            const bufKey = `${b.symbol}:${tf}`;
            if (!this.completedCandles.has(bufKey)) {
                this.completedCandles.set(bufKey, []);
            }
            const buf = this.completedCandles.get(bufKey)!;
            buf.push(candle);
            if (buf.length > this.BUFFER_SIZE) buf.shift();

            // Persist to DB (non-blocking, best-effort)
            this.persistCandle(b, candle).catch(err =>
                logger.warn(`Candle persist error [${b.symbol} ${tf}]: ${err.message}`)
            );

            // Emit for strategy evaluation
            this.emit('candle_close', { symbol: b.symbol, timeframe: tf, candle });
            logger.debug(`📊 Candle closed [${b.symbol} ${tf}] O:${b.open} H:${b.high} L:${b.low} C:${b.close} V:${b.volume}`);

            // Reset builder for next period
            this.builders.set(`${b.symbol}:${tf}`, this.createBuilder(b.symbol, tf, b.close, now));
        }
    }

    private async persistCandle(b: CandleBuilder, candle: CandleInput): Promise<void> {
        await prisma.candle.upsert({
            where: {
                symbol_timeframe_timestamp: {
                    symbol: b.symbol,
                    timeframe: b.timeframe as any,
                    timestamp: b.startTime,
                },
            },
            update: {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: Number(candle.volume),
            },
            create: {
                symbol: b.symbol,
                timeframe: b.timeframe as any,
                timestamp: b.startTime,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: Number(candle.volume),
            },
        });
    }
}

export const candleAggregator = new CandleAggregator();
