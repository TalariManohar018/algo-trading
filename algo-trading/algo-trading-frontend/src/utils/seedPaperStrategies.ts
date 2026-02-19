import { ExecutableStrategy } from '../services/paperTradingEngine';

/**
 * Demo strategies for paper trading
 */
export const demoStrategies: ExecutableStrategy[] = [
    {
        id: 'STR-DEMO-1',
        name: 'Iron Condor NIFTY',
        description: 'Sell OTM call and put, buy further OTM options',
        symbol: 'NIFTY50',
        instrumentType: 'INDEX',
        timeframe: 'ONE_MINUTE',
        quantity: 50,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        entryConditions: [
            {
                id: 'entry-1',
                indicatorType: 'RSI',
                conditionType: 'GT',
                value: 40,
                logic: 'AND',
                period: 14,
            },
            {
                id: 'entry-2',
                indicatorType: 'RSI',
                conditionType: 'LT',
                value: 60,
                logic: 'AND',
                period: 14,
            },
        ],
        exitConditions: [
            {
                id: 'exit-1',
                indicatorType: 'PRICE',
                conditionType: 'GT',
                value: 18200,
                logic: 'OR',
            },
            {
                id: 'exit-2',
                indicatorType: 'PRICE',
                conditionType: 'LT',
                value: 17800,
                logic: 'OR',
            },
        ],
        maxTradesPerDay: 3,
        tradingWindow: {
            startTime: '09:15',
            endTime: '15:30',
        },
        squareOffTime: '15:25',
        riskConfig: {
            maxLossPerTrade: 500,
            maxProfitTarget: 1000,
            stopLossPercent: 2,
            takeProfitPercent: 4,
        },
        status: 'ACTIVE',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date(),
    },
    {
        id: 'STR-DEMO-2',
        name: 'Bull Call Spread',
        description: 'Buy ATM call, sell OTM call',
        symbol: 'BANKNIFTY',
        instrumentType: 'INDEX',
        timeframe: 'ONE_MINUTE',
        quantity: 25,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        entryConditions: [
            {
                id: 'entry-1',
                indicatorType: 'EMA',
                conditionType: 'CROSS_ABOVE',
                value: 47800,
                logic: 'AND',
                period: 20,
            },
        ],
        exitConditions: [
            {
                id: 'exit-1',
                indicatorType: 'PRICE',
                conditionType: 'GT',
                value: 48200,
                logic: 'AND',
            },
        ],
        maxTradesPerDay: 2,
        tradingWindow: {
            startTime: '09:15',
            endTime: '15:30',
        },
        squareOffTime: '15:25',
        riskConfig: {
            maxLossPerTrade: 800,
            maxProfitTarget: 1500,
            stopLossPercent: 3,
            takeProfitPercent: 5,
        },
        status: 'STOPPED',
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date(),
    },
    {
        id: 'STR-DEMO-3',
        name: 'Straddle Strategy',
        description: 'Buy ATM call and put simultaneously',
        symbol: 'NIFTY50',
        instrumentType: 'INDEX',
        timeframe: 'ONE_MINUTE',
        quantity: 75,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        entryConditions: [
            {
                id: 'entry-1',
                indicatorType: 'RSI',
                conditionType: 'GT',
                value: 45,
                logic: 'AND',
                period: 14,
            },
            {
                id: 'entry-2',
                indicatorType: 'RSI',
                conditionType: 'LT',
                value: 55,
                logic: 'AND',
                period: 14,
            },
        ],
        exitConditions: [
            {
                id: 'exit-1',
                indicatorType: 'PRICE',
                conditionType: 'GT',
                value: 18100,
                logic: 'OR',
            },
            {
                id: 'exit-2',
                indicatorType: 'PRICE',
                conditionType: 'LT',
                value: 17900,
                logic: 'OR',
            },
        ],
        maxTradesPerDay: 4,
        tradingWindow: {
            startTime: '09:15',
            endTime: '15:30',
        },
        squareOffTime: '15:25',
        riskConfig: {
            maxLossPerTrade: 600,
            maxProfitTarget: 1200,
            stopLossPercent: 2.5,
            takeProfitPercent: 4.5,
        },
        status: 'ACTIVE',
        createdAt: new Date('2024-02-12'),
        updatedAt: new Date(),
    },
];

/**
 * Load demo strategies into localStorage if none exist
 */
export function seedPaperStrategies(): void {
    const existing = localStorage.getItem('trading_strategies');

    if (!existing || JSON.parse(existing).length === 0) {
        console.log('📋 Seeding demo strategies for paper trading...');
        localStorage.setItem('trading_strategies', JSON.stringify(demoStrategies));
        console.log(`✅ Loaded ${demoStrategies.length} demo strategies`);
    }
}
