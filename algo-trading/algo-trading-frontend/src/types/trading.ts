/**
 * ───────────────────────────────────────────────────────────────────
 *  Core Trading Types
 *  Single source-of-truth for every type the paper-trading core uses.
 *  Imported by services, context, and components.
 * ───────────────────────────────────────────────────────────────────
 */

/* ── Enums / Literals ──────────────────────────────────────────── */

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus =
    | 'CREATED'
    | 'PLACED'
    | 'PARTIALLY_FILLED'
    | 'FILLED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'CLOSED';

export type PositionSide = 'LONG' | 'SHORT';
export type PositionStatus = 'OPEN' | 'CLOSED';

export type EngineStatus = 'STOPPED' | 'RUNNING' | 'PAUSED' | 'LOCKED';

export type StrategyStatus = 'CREATED' | 'RUNNING' | 'STOPPED' | 'ACTIVE' | 'PAUSED' | 'ERROR';

export type TimeFrame = 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'THIRTY_MINUTES' | 'ONE_HOUR' | 'ONE_DAY';

export type ConditionOperator =
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'GREATER_THAN_EQUAL'
    | 'LESS_THAN_EQUAL'
    | 'EQUALS'
    | 'CROSS_ABOVE'
    | 'CROSS_BELOW'
    | 'GT'
    | 'LT';

export type IndicatorType =
    | 'EMA'
    | 'SMA'
    | 'RSI'
    | 'MACD'
    | 'VWAP'
    | 'PRICE'
    | 'Price'
    | 'Volume'
    | 'ADX'
    | 'Bollinger Bands';

export type ConditionLogic = 'AND' | 'OR';

export type ActivityType =
    | 'CANDLE'
    | 'SIGNAL'
    | 'ORDER'
    | 'FILL'
    | 'POSITION'
    | 'EXIT'
    | 'ALERT'
    | 'ERROR'
    | string;

/* ── Candle ────────────────────────────────────────────────────── */

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

/* ── Strategy Condition ────────────────────────────────────────── */

export interface StrategyCondition {
    id: string;
    indicatorType: IndicatorType | string;
    conditionType: ConditionOperator | string;
    value: number;
    logic?: ConditionLogic;
    period?: number;
}

/* ── Risk Config (per-strategy) ────────────────────────────────── */

export interface RiskConfig {
    maxLossPerTrade: number;
    maxProfitTarget?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
}

/* ── Trading Window ────────────────────────────────────────────── */

export interface TradingWindow {
    startTime: string; // HH:mm
    endTime: string;
}

/* ── Executable Strategy ───────────────────────────────────────── */

export interface ExecutableStrategy {
    id: string;
    name: string;
    description?: string;
    symbol: string;
    instrumentType?: string;
    timeframe: TimeFrame | string;
    quantity: number;
    orderType: OrderType;
    productType: string;
    entryConditions: StrategyCondition[];
    exitConditions: StrategyCondition[];
    maxTradesPerDay: number;
    tradingWindow?: TradingWindow;
    squareOffTime?: string; // HH:mm
    riskConfig?: RiskConfig;
    status: StrategyStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

/* ── Order ─────────────────────────────────────────────────────── */

export interface Order {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    orderType: OrderType;
    limitPrice?: number;
    status: OrderStatus;
    placedPrice?: number;
    filledPrice?: number;
    filledQuantity?: number;
    slippage?: number;
    createdAt: Date;
    placedAt?: Date;
    filledAt?: Date;
    rejectedReason?: string;
}

/* ── Position ──────────────────────────────────────────────────── */

export interface Position {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: PositionSide;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    marginUsed?: number;
    status: PositionStatus;
    openedAt: Date;
    closedAt?: Date;
}

/* ── Trade (closed position record) ────────────────────────────── */

export interface Trade {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    executedAt: Date;
}

/* ── Wallet ────────────────────────────────────────────────────── */

export interface WalletState {
    balance: number;
    usedMargin: number;
    availableMargin: number;
    realizedPnl: number;
    unrealizedPnl: number;
}

/* ── Risk State ────────────────────────────────────────────────── */

export interface RiskState {
    dailyLoss: number;
    dailyTradeCount: number;
    isLocked: boolean;
    lockReason?: string;
}

/* ── Risk Limits (from settings) ───────────────────────────────── */

export interface RiskLimits {
    maxLossPerDay: number;
    maxTradesPerDay: number;
    maxCapitalPerTrade: number; // percent of balance
    maxDrawdownPercent?: number;
}

/* ── Activity Event ────────────────────────────────────────────── */

export interface ActivityEvent {
    id: string;
    type: ActivityType;
    message: string;
    timestamp: Date;
    data?: Record<string, unknown>;
    icon?: string;
    color?: string;
}

/* ── PnL Summary ───────────────────────────────────────────────── */

export interface PnLSummary {
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    netPnl: number;
    returnPercent: number;
    peakBalance: number;
    drawdown: number;
    drawdownPercent: number;
}

/* ── Margin Lock ───────────────────────────────────────────────── */

export interface MarginLock {
    orderId: string;
    amount: number;
    lockedAt: Date;
}

/* ── Indicator Values (for condition engine) ───────────────────── */

export interface IndicatorValues {
    ema?: Record<number, number>;
    sma?: Record<number, number>;
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    vwap?: number;
    price: number;
    volume: number;
    adx?: number;
    bollingerBands?: { upper: number; middle: number; lower: number };
}

/* ── Simulator Config ──────────────────────────────────────────── */

export interface SimulatorConfig {
    tickInterval: number;   // ms between candles (default 60 000)
    volatility: number;     // 0–1
    symbols: string[];
    basePrices: Record<string, number>;
    speed: number;          // multiplier: 1×, 2×, 5×, 10×
}

/* ── Order Config ──────────────────────────────────────────────── */

export interface OrderConfig {
    placementDelayMs: number;
    fillDelayMs: number;
    slippagePercent: number;
    rejectionRate: number;
    partialFillProbability: number;
    partialFillMinPercent: number;
}

/* ── Evaluation State (condition evaluator) ────────────────────── */

export interface EvaluationState {
    previousCandles: Candle[];
    indicators: Record<string, number>;
}

/* ── Complete Trading State (persisted) ────────────────────────── */

export interface TradingState {
    orders: Order[];
    positions: Position[];
    trades: Trade[];
    wallet: WalletState;
    riskState: RiskState;
    strategies: ExecutableStrategy[];
    activityLog: ActivityEvent[];
    engineStatus: EngineStatus;
}

/* ── Risk Guard (UI display) ───────────────────────────────────── */

export interface RiskGuard {
    maxLossPerDay: number;
    currentDayLoss: number;
    remainingRisk: number;
    tradeCountToday: number;
    maxTradesPerDay: number;
    isRiskBreached: boolean;
    breachReason?: string;
}
