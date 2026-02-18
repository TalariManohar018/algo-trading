export interface Strategy {
    id: string;
    name: string;
    instrument: 'NIFTY' | 'BANKNIFTY';
    status: 'Running' | 'Stopped';
    pnl: number;
    winRate: number;
    totalTrades: number;
    conditions: Condition[];
}

export interface Condition {
    id: string;
    indicator: string;
    condition: string;
    value: string;
    logic?: 'AND' | 'OR';
}

export interface Trade {
    id: string;
    strategyName: string;
    entryTime: string;
    exitTime: string;
    instrument: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
}

export interface EquityPoint {
    date: string;
    equity: number;
}

export const mockStrategies: Strategy[] = [
    {
        id: '1',
        name: 'EMA Crossover Strategy',
        instrument: 'NIFTY',
        status: 'Running',
        pnl: 45230.50,
        winRate: 68.5,
        totalTrades: 127,
        conditions: [
            { id: '1', indicator: 'EMA', condition: 'Crosses Above', value: 'EMA 50', logic: 'AND' },
            { id: '2', indicator: 'RSI', condition: '>', value: '50' }
        ]
    },
    {
        id: '2',
        name: 'RSI Momentum',
        instrument: 'BANKNIFTY',
        status: 'Running',
        pnl: 28750.25,
        winRate: 62.3,
        totalTrades: 89,
        conditions: [
            { id: '1', indicator: 'RSI', condition: '<', value: '30', logic: 'OR' },
            { id: '2', indicator: 'RSI', condition: '>', value: '70' }
        ]
    },
    {
        id: '3',
        name: 'VWAP Reversion',
        instrument: 'NIFTY',
        status: 'Stopped',
        pnl: -5420.75,
        winRate: 45.2,
        totalTrades: 53,
        conditions: [
            { id: '1', indicator: 'Price', condition: 'Crosses Below', value: 'VWAP', logic: 'AND' },
            { id: '2', indicator: 'Volume', condition: '>', value: 'Avg Volume' }
        ]
    },
    {
        id: '4',
        name: 'Trend Following',
        instrument: 'BANKNIFTY',
        status: 'Running',
        pnl: 67890.00,
        winRate: 71.8,
        totalTrades: 203,
        conditions: [
            { id: '1', indicator: 'EMA', condition: '>', value: 'EMA 200', logic: 'AND' },
            { id: '2', indicator: 'ADX', condition: '>', value: '25' }
        ]
    },
    {
        id: '5',
        name: 'Mean Reversion Pro',
        instrument: 'NIFTY',
        status: 'Stopped',
        pnl: 12345.60,
        winRate: 58.4,
        totalTrades: 76,
        conditions: [
            { id: '1', indicator: 'RSI', condition: '<', value: '35', logic: 'AND' },
            { id: '2', indicator: 'Price', condition: 'Crosses Above', value: 'VWAP' }
        ]
    },
    {
        id: '6',
        name: 'Breakout Scanner',
        instrument: 'BANKNIFTY',
        status: 'Running',
        pnl: 34560.90,
        winRate: 64.7,
        totalTrades: 142,
        conditions: [
            { id: '1', indicator: 'Price', condition: '>', value: 'High of Day', logic: 'AND' },
            { id: '2', indicator: 'Volume', condition: '>', value: '1.5x Avg Volume' }
        ]
    }
];

export const mockEquityData: EquityPoint[] = [
    { date: '2024-01', equity: 100000 },
    { date: '2024-02', equity: 105230 },
    { date: '2024-03', equity: 112450 },
    { date: '2024-04', equity: 108900 },
    { date: '2024-05', equity: 118750 },
    { date: '2024-06', equity: 125340 },
    { date: '2024-07', equity: 121200 },
    { date: '2024-08', equity: 132890 },
    { date: '2024-09', equity: 139450 },
    { date: '2024-10', equity: 145670 },
    { date: '2024-11', equity: 152340 },
    { date: '2024-12', equity: 163980 },
];

export const mockTrades: Trade[] = [
    {
        id: '1',
        strategyName: 'EMA Crossover Strategy',
        entryTime: '2024-12-15 09:30:00',
        exitTime: '2024-12-15 14:45:00',
        instrument: 'NIFTY FUT',
        side: 'BUY',
        entryPrice: 21450.50,
        exitPrice: 21580.75,
        quantity: 50,
        pnl: 6512.50
    },
    {
        id: '2',
        strategyName: 'RSI Momentum',
        entryTime: '2024-12-14 10:15:00',
        exitTime: '2024-12-14 15:20:00',
        instrument: 'BANKNIFTY FUT',
        side: 'SELL',
        entryPrice: 47890.25,
        exitPrice: 47650.00,
        quantity: 25,
        pnl: 6006.25
    },
    {
        id: '3',
        strategyName: 'Trend Following',
        entryTime: '2024-12-13 09:45:00',
        exitTime: '2024-12-13 13:30:00',
        instrument: 'BANKNIFTY FUT',
        side: 'BUY',
        entryPrice: 47320.00,
        exitPrice: 47680.50,
        quantity: 25,
        pnl: 9012.50
    },
    {
        id: '4',
        strategyName: 'EMA Crossover Strategy',
        entryTime: '2024-12-12 11:20:00',
        exitTime: '2024-12-12 14:15:00',
        instrument: 'NIFTY FUT',
        side: 'BUY',
        entryPrice: 21280.75,
        exitPrice: 21195.25,
        quantity: 50,
        pnl: -4275.00
    },
    {
        id: '5',
        strategyName: 'Breakout Scanner',
        entryTime: '2024-12-11 09:35:00',
        exitTime: '2024-12-11 15:10:00',
        instrument: 'BANKNIFTY FUT',
        side: 'BUY',
        entryPrice: 47120.00,
        exitPrice: 47545.75,
        quantity: 25,
        pnl: 10643.75
    }
];

export const getActiveStrategies = () =>
    mockStrategies.filter(s => s.status === 'Running');

export const getTotalPnL = () =>
    mockStrategies.reduce((sum, s) => sum + s.pnl, 0);

export const getAverageWinRate = () => {
    const rates = mockStrategies.map(s => s.winRate);
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
};
