import { EventEmitter } from '../utils/EventEmitter';

export interface Candle {
    symbol: string;
    timeframe: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface SimulatorConfig {
    tickInterval: number;    // base interval in ms (default 60000 = 1 min)
    volatility: number;      // 0.0 to 1.0
    symbols: string[];
    basePrices: Record<string, number>;
    speed: number;           // multiplier: 1x, 2x, 5x, 10x
}

export type SimulatorMode = 'live' | 'replay';

class MarketDataSimulator extends EventEmitter {
    private isRunning = false;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private config: SimulatorConfig;
    private currentPrices: Record<string, number> = {};
    private lastCandles: Record<string, Candle> = {};
    private mode: SimulatorMode = 'live';

    // Replay state
    private replayData: Candle[] = [];
    private replayIndex: number = 0;
    private candleHistory: Record<string, Candle[]> = {};

    constructor() {
        super();
        this.config = {
            tickInterval: 60000,
            volatility: 0.002,
            symbols: ['NIFTY', 'BANKNIFTY', 'FINNIFTY'],
            basePrices: {
                'NIFTY': 22000,
                'BANKNIFTY': 46000,
                'FINNIFTY': 20000,
            },
            speed: 1,
        };
    }

    // ── Configuration ────────────────────────────────────────────────
    configure(config: Partial<SimulatorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    setSpeed(speed: number): void {
        this.config.speed = Math.max(1, Math.min(100, speed));
        if (this.isRunning) {
            // Restart timer with new speed
            this.stopTimer();
            this.startTimer();
        }
        this.emit('speedChanged', this.config.speed);
    }

    getSpeed(): number { return this.config.speed; }

    // ── Live mode ────────────────────────────────────────────────────
    startSimulator(config?: Partial<SimulatorConfig>): void {
        if (this.isRunning) return;
        if (config) this.config = { ...this.config, ...config };
        this.mode = 'live';

        this.config.symbols.forEach(symbol => {
            this.currentPrices[symbol] = this.config.basePrices[symbol] || 20000;
            if (!this.candleHistory[symbol]) this.candleHistory[symbol] = [];
        });

        this.isRunning = true;
        this.emit('started', { mode: 'live' });
        this.generateCandles();
        this.startTimer();
    }

    stopSimulator(): void {
        if (!this.isRunning) return;
        this.stopTimer();
        this.isRunning = false;
        this.emit('stopped', { mode: this.mode });
    }

    // ── Replay mode ──────────────────────────────────────────────────
    /**
     * Load candle data for replay from raw array or JSON string.
     * Each candle must have at least: symbol, open, high, low, close, volume, timestamp.
     */
    loadReplayData(data: Candle[] | string): void {
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                this.replayData = Array.isArray(parsed) ? parsed.map(this.normalizeCandle) : [];
            } catch {
                console.error('Invalid replay JSON');
                this.replayData = [];
            }
        } else {
            this.replayData = data.map(this.normalizeCandle);
        }
        // Sort by timestamp ascending
        this.replayData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.replayIndex = 0;
        this.emit('replayLoaded', { count: this.replayData.length });
    }

    /**
     * Generate seed replay data for testing (N candles per symbol).
     */
    generateSeedData(candleCount: number = 100): Candle[] {
        const candles: Candle[] = [];
        const baseTime = Date.now() - candleCount * 60000;

        for (const symbol of this.config.symbols) {
            let price = this.config.basePrices[symbol] || 20000;
            for (let i = 0; i < candleCount; i++) {
                const changePercent = (Math.random() - 0.5) * 2 * this.config.volatility;
                const open = price;
                const close = open * (1 + changePercent);
                const range = Math.abs(close - open) * (1.5 + Math.random() * 0.5);
                const high = Math.max(open, close) + range * Math.random();
                const low = Math.min(open, close) - range * Math.random();
                const volume = Math.floor(1000 + Math.random() * 9000);
                price = close;

                candles.push({
                    symbol,
                    timeframe: '1m',
                    timestamp: new Date(baseTime + i * 60000),
                    open: Math.round(open * 100) / 100,
                    high: Math.round(high * 100) / 100,
                    low: Math.round(low * 100) / 100,
                    close: Math.round(close * 100) / 100,
                    volume,
                });
            }
        }

        candles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return candles;
    }

    startReplay(config?: Partial<SimulatorConfig>): void {
        if (this.isRunning) this.stopSimulator();
        if (config) this.config = { ...this.config, ...config };

        if (this.replayData.length === 0) {
            this.replayData = this.generateSeedData();
        }

        this.mode = 'replay';
        this.replayIndex = 0;
        this.isRunning = true;

        // Initialize prices from first candles
        this.config.symbols.forEach(symbol => {
            const first = this.replayData.find(c => c.symbol === symbol);
            if (first) this.currentPrices[symbol] = first.open;
            if (!this.candleHistory[symbol]) this.candleHistory[symbol] = [];
        });

        this.emit('started', { mode: 'replay', totalCandles: this.replayData.length });
        this.replayTick();
        this.startTimer();
    }

    getReplayProgress(): { current: number; total: number; percent: number } {
        const total = this.replayData.length;
        return {
            current: this.replayIndex,
            total,
            percent: total > 0 ? Math.round((this.replayIndex / total) * 100) : 0,
        };
    }

    // ── Timers ───────────────────────────────────────────────────────
    private startTimer(): void {
        const interval = Math.max(50, this.config.tickInterval / this.config.speed);
        this.intervalId = setInterval(() => {
            if (this.mode === 'replay') this.replayTick();
            else this.generateCandles();
        }, interval);
    }

    private stopTimer(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // ── Live candle generation ───────────────────────────────────────
    private generateCandles(): void {
        const timestamp = new Date();
        this.config.symbols.forEach(symbol => {
            const candle = this.generateCandle(symbol, timestamp);
            this.pushCandle(symbol, candle);
            this.emit('candle', candle);
        });
    }

    private generateCandle(symbol: string, timestamp: Date): Candle {
        const currentPrice = this.currentPrices[symbol];
        const volatility = this.config.volatility;
        const changePercent = (Math.random() - 0.5) * 2 * volatility;
        const open = currentPrice;
        const close = open * (1 + changePercent);
        const range = Math.abs(close - open) * (1.5 + Math.random() * 0.5);
        const high = Math.max(open, close) + range * Math.random();
        const low = Math.min(open, close) - range * Math.random();
        const volume = Math.floor(1000 + Math.random() * 9000);
        this.currentPrices[symbol] = close;

        return {
            symbol,
            timeframe: '1m',
            timestamp,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume,
        };
    }

    // ── Replay tick ──────────────────────────────────────────────────
    private replayTick(): void {
        if (this.replayIndex >= this.replayData.length) {
            this.stopSimulator();
            this.emit('replayComplete', {
                totalCandles: this.replayData.length,
            });
            return;
        }

        // Emit all candles at the same timestamp index (multiple symbols)
        const currentTime = new Date(this.replayData[this.replayIndex].timestamp).getTime();
        while (
            this.replayIndex < this.replayData.length &&
            new Date(this.replayData[this.replayIndex].timestamp).getTime() === currentTime
        ) {
            const candle = this.replayData[this.replayIndex];
            this.currentPrices[candle.symbol] = candle.close;
            this.pushCandle(candle.symbol, candle);
            this.emit('candle', candle);
            this.replayIndex++;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private pushCandle(symbol: string, candle: Candle): void {
        if (!this.candleHistory[symbol]) this.candleHistory[symbol] = [];
        this.candleHistory[symbol].push(candle);
        // Keep last 500 candles per symbol
        if (this.candleHistory[symbol].length > 500) {
            this.candleHistory[symbol] = this.candleHistory[symbol].slice(-500);
        }
        this.lastCandles[symbol] = candle;
    }

    private normalizeCandle(raw: any): Candle {
        return {
            symbol: raw.symbol || 'UNKNOWN',
            timeframe: raw.timeframe || '1m',
            timestamp: new Date(raw.timestamp),
            open: Number(raw.open),
            high: Number(raw.high),
            low: Number(raw.low),
            close: Number(raw.close),
            volume: Number(raw.volume || 0),
        };
    }

    getCurrentPrice(symbol: string): number {
        return this.currentPrices[symbol] || this.config.basePrices[symbol] || 20000;
    }

    getLastCandle(symbol: string): Candle | undefined {
        return this.lastCandles[symbol];
    }

    getCandleHistory(symbol: string, count?: number): Candle[] {
        const hist = this.candleHistory[symbol] || [];
        return count ? hist.slice(-count) : [...hist];
    }

    isActive(): boolean { return this.isRunning; }
    getMode(): SimulatorMode { return this.mode; }

    subscribe(callback: (candle: Candle) => void): () => void {
        this.on('candle', callback);
        return () => this.off('candle', callback);
    }

    reset(): void {
        this.stopSimulator();
        this.replayData = [];
        this.replayIndex = 0;
        this.candleHistory = {};
        this.lastCandles = {};
        this.currentPrices = {};
    }
}

export const marketDataSimulator = new MarketDataSimulator();
