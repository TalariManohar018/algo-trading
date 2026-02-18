/**
 * ───────────────────────────────────────────────────────────────────
 *  Pluggable Storage Adapter
 *  Defines the interface every persistence back-end must implement.
 *  The default export is a localStorage adapter; swap it for an
 *  API-backed adapter when a real backend is available.
 * ───────────────────────────────────────────────────────────────────
 */

import type {
    Order,
    Position,
    Trade,
    WalletState,
    RiskState,
    ExecutableStrategy,
    ActivityEvent,
    TradingState,
} from '../../types/trading';

/* ── Interface ─────────────────────────────────────────────────── */

export interface StorageAdapter {
    /* ── Bulk ──────────────────────────────────────────────────────── */
    loadState(): Promise<TradingState>;
    saveState(state: TradingState): Promise<void>;

    /* ── Orders ────────────────────────────────────────────────────── */
    getOrders(): Promise<Order[]>;
    saveOrders(orders: Order[]): Promise<void>;

    /* ── Positions ─────────────────────────────────────────────────── */
    getPositions(): Promise<Position[]>;
    savePositions(positions: Position[]): Promise<void>;

    /* ── Trades ────────────────────────────────────────────────────── */
    getTrades(): Promise<Trade[]>;
    saveTrades(trades: Trade[]): Promise<void>;

    /* ── Wallet ────────────────────────────────────────────────────── */
    getWallet(): Promise<WalletState>;
    saveWallet(wallet: WalletState): Promise<void>;

    /* ── Risk ──────────────────────────────────────────────────────── */
    getRiskState(): Promise<RiskState>;
    saveRiskState(risk: RiskState): Promise<void>;

    /* ── Strategies ────────────────────────────────────────────────── */
    getStrategies(): Promise<ExecutableStrategy[]>;
    saveStrategies(strategies: ExecutableStrategy[]): Promise<void>;

    /* ── Activity ──────────────────────────────────────────────────── */
    getActivityLog(): Promise<ActivityEvent[]>;
    saveActivityLog(log: ActivityEvent[]): Promise<void>;

    /* ── Reset ─────────────────────────────────────────────────────── */
    clear(): Promise<void>;
}

/* ── LocalStorage Implementation ──────────────────────────────── */

const KEYS = {
    orders: 'trading_orders',
    positions: 'trading_positions',
    trades: 'trading_trades',
    wallet: 'algotrader_wallet',
    risk: 'trading_risk_state',
    strategies: 'trading_strategies',
    activity: 'trading_activity',
} as const;

const INITIAL_CAPITAL = 100_000;

function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
}

const defaultWallet: WalletState = {
    balance: INITIAL_CAPITAL,
    usedMargin: 0,
    availableMargin: INITIAL_CAPITAL,
    realizedPnl: 0,
    unrealizedPnl: 0,
};

const defaultRisk: RiskState = {
    dailyLoss: 0,
    dailyTradeCount: 0,
    isLocked: false,
    lockReason: undefined,
};

export class LocalStorageAdapter implements StorageAdapter {
    /* ── Bulk ──────────────────────────────────────────────────────── */
    async loadState(): Promise<TradingState> {
        return {
            orders: await this.getOrders(),
            positions: await this.getPositions(),
            trades: await this.getTrades(),
            wallet: await this.getWallet(),
            riskState: await this.getRiskState(),
            strategies: await this.getStrategies(),
            activityLog: await this.getActivityLog(),
            engineStatus: 'STOPPED',
        };
    }

    async saveState(state: TradingState): Promise<void> {
        await Promise.all([
            this.saveOrders(state.orders),
            this.savePositions(state.positions),
            this.saveTrades(state.trades),
            this.saveWallet(state.wallet),
            this.saveRiskState(state.riskState),
            this.saveStrategies(state.strategies),
            this.saveActivityLog(state.activityLog),
        ]);
    }

    /* ── Individual getters/setters ────────────────────────────────── */
    async getOrders(): Promise<Order[]> {
        return readJSON<Order[]>(KEYS.orders, []);
    }
    async saveOrders(orders: Order[]): Promise<void> {
        writeJSON(KEYS.orders, orders);
    }

    async getPositions(): Promise<Position[]> {
        return readJSON<Position[]>(KEYS.positions, []);
    }
    async savePositions(positions: Position[]): Promise<void> {
        writeJSON(KEYS.positions, positions);
    }

    async getTrades(): Promise<Trade[]> {
        return readJSON<Trade[]>(KEYS.trades, []);
    }
    async saveTrades(trades: Trade[]): Promise<void> {
        writeJSON(KEYS.trades, trades);
    }

    async getWallet(): Promise<WalletState> {
        return readJSON<WalletState>(KEYS.wallet, { ...defaultWallet });
    }
    async saveWallet(wallet: WalletState): Promise<void> {
        writeJSON(KEYS.wallet, wallet);
    }

    async getRiskState(): Promise<RiskState> {
        return readJSON<RiskState>(KEYS.risk, { ...defaultRisk });
    }
    async saveRiskState(risk: RiskState): Promise<void> {
        writeJSON(KEYS.risk, risk);
    }

    async getStrategies(): Promise<ExecutableStrategy[]> {
        return readJSON<ExecutableStrategy[]>(KEYS.strategies, []);
    }
    async saveStrategies(strategies: ExecutableStrategy[]): Promise<void> {
        writeJSON(KEYS.strategies, strategies);
    }

    async getActivityLog(): Promise<ActivityEvent[]> {
        return readJSON<ActivityEvent[]>(KEYS.activity, []);
    }
    async saveActivityLog(log: ActivityEvent[]): Promise<void> {
        writeJSON(KEYS.activity, log);
    }

    async clear(): Promise<void> {
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    }
}

/* ── Singleton factory ────────────────────────────────────────── */

let _adapter: StorageAdapter = new LocalStorageAdapter();

/** Replace the global adapter (e.g. with an API adapter). */
export function setStorageAdapter(adapter: StorageAdapter): void {
    _adapter = adapter;
}

/** Get the current adapter. */
export function getStorageAdapter(): StorageAdapter {
    return _adapter;
}
