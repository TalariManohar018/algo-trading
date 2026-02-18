import { paperTradingEngine } from '../paperTradingEngine';
import { marketDataSimulator } from '../marketDataSimulator';
import { ExecutableStrategy } from '../paperTradingEngine';

describe('PaperTradingEngine - Integration Test', () => {
    beforeEach(() => {
        // Clean up
        paperTradingEngine.stopEngine();
        marketDataSimulator.stop();
    });

    afterEach(() => {
        paperTradingEngine.stopEngine();
        marketDataSimulator.stop();
    });

    test('should start and stop engine', async () => {
        await paperTradingEngine.startEngine();
        expect(paperTradingEngine.getStatus()).toBe('RUNNING');

        await paperTradingEngine.stopEngine();
        expect(paperTradingEngine.getStatus()).toBe('STOPPED');
    });

    test('should evaluate strategy on candle close', (done) => {
        const strategy: ExecutableStrategy = {
            id: 'TEST-1',
            name: 'Simple Price Strategy',
            description: 'Buy when price > 18000',
            symbol: 'NIFTY50',
            instrumentType: 'INDEX',
            timeframe: '1m',
            quantity: 100,
            orderType: 'MARKET',
            productType: 'INTRADAY',
            entryConditions: [
                {
                    id: 'c1',
                    indicatorType: 'PRICE',
                    conditionType: 'GT',
                    value: 18000,
                    logic: 'AND',
                },
            ],
            exitConditions: [
                {
                    id: 'c2',
                    indicatorType: 'PRICE',
                    conditionType: 'LT',
                    value: 17900,
                    logic: 'AND',
                },
            ],
            maxTradesPerDay: 5,
            tradingWindow: {
                startTime: '09:15',
                endTime: '15:30',
            },
            squareOffTime: '15:25',
            riskConfig: {
                maxLossPerTrade: 500,
                maxProfitTarget: 1000,
                stopLossPercent: 1,
                takeProfitPercent: 2,
            },
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        paperTradingEngine.addStrategy(strategy);

        let activityCount = 0;
        paperTradingEngine.on('activity', (event) => {
            activityCount++;
            console.log(`Activity: ${event.type} - ${event.message}`);

            // After collecting a few events, consider test complete
            if (activityCount >= 5) {
                paperTradingEngine.stopEngine();
                done();
            }
        });

        paperTradingEngine.startEngine();

        // Let it run for 5 seconds
        setTimeout(() => {
            paperTradingEngine.stopEngine();
            expect(activityCount).toBeGreaterThan(0);
            if (activityCount < 5) {
                done();
            }
        }, 5000);
    }, 10000); // 10 second timeout

    test('should respect max trades per day', async () => {
        const strategy: ExecutableStrategy = {
            id: 'TEST-2',
            name: 'Limited Trades Strategy',
            description: 'Max 2 trades per day',
            symbol: 'NIFTY50',
            instrumentType: 'INDEX',
            timeframe: '1m',
            quantity: 100,
            orderType: 'MARKET',
            productType: 'INTRADAY',
            entryConditions: [
                {
                    id: 'c1',
                    indicatorType: 'PRICE',
                    conditionType: 'GT',
                    value: 1,
                    logic: 'AND',
                },
            ],
            exitConditions: [
                {
                    id: 'c2',
                    indicatorType: 'PRICE',
                    conditionType: 'LT',
                    value: 1,
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
                maxLossPerTrade: 500,
                maxProfitTarget: 1000,
                stopLossPercent: 1,
                takeProfitPercent: 2,
            },
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        paperTradingEngine.addStrategy(strategy);

        let orderCount = 0;
        paperTradingEngine.on('orderCreated', () => {
            orderCount++;
        });

        await paperTradingEngine.startEngine();

        // Wait for some processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        await paperTradingEngine.stopEngine();

        // Should not exceed max trades
        expect(orderCount).toBeLessThanOrEqual(2);
    });

    test('should emit activity events', (done) => {
        let candleReceived = false;
        let signalReceived = false;

        paperTradingEngine.on('activity', (event) => {
            if (event.type === 'CANDLE') {
                candleReceived = true;
            }
            if (event.type === 'SIGNAL') {
                signalReceived = true;
            }

            if (candleReceived) {
                paperTradingEngine.stopEngine();
                done();
            }
        });

        paperTradingEngine.startEngine();

        // Timeout after 8 seconds
        setTimeout(() => {
            paperTradingEngine.stopEngine();
            expect(candleReceived).toBe(true);
            if (!candleReceived) {
                done();
            }
        }, 8000);
    }, 10000);
});
