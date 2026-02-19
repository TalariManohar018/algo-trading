export type TimeFrame = 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'THIRTY_MINUTES' | 'ONE_HOUR' | 'ONE_DAY';
export type OrderType = 'MARKET' | 'LIMIT';
export type ProductType = 'MIS' | 'NRML';
export type StrategyStatus = 'CREATED' | 'RUNNING' | 'STOPPED' | 'ERROR';
export type IndicatorType = 'EMA' | 'SMA' | 'RSI' | 'MACD' | 'VWAP' | 'Price' | 'Volume' | 'ADX' | 'Bollinger Bands';
export type ConditionType = 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'GREATER_THAN_EQUAL' | 'LESS_THAN_EQUAL';
export type ConditionLogic = 'AND' | 'OR';

export interface StrategyCondition {
    id: string;
    indicatorType: IndicatorType;
    conditionType: ConditionType;
    value: number;
    logic?: ConditionLogic;
    period?: number;
}

export interface RiskConfig {
    maxLossPerTrade: number;
    maxProfitTarget?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
}

export interface TradingWindow {
    startTime: string;
    endTime: string;
}

export interface ExecutableStrategy {
    id: string;
    name: string;
    description?: string;
    symbol: string;
    instrumentType: 'OPTION' | 'FUTURE';
    timeframe: TimeFrame;
    quantity: number;
    orderType: OrderType;
    productType: ProductType;
    entryConditions: StrategyCondition[];
    exitConditions: StrategyCondition[];
    maxTradesPerDay: number;
    tradingWindow: TradingWindow;
    squareOffTime: string;
    riskConfig: RiskConfig;
    status: StrategyStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
}

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
