/**
 * Manual Paper Trading Simulation Test
 * 
 * Run this script to test the paper trading engine:
 * 1. Start frontend dev server: npm run dev
 * 2. Open browser and navigate to the app
 * 3. Open browser console and run:
 * 
 * // Import the test
 * const script = document.createElement('script');
 * script.type = 'module';
 * script.src = '/src/test/manualSimulation.ts';
 * document.body.appendChild(script);
 */

import { paperTradingEngine, ExecutableStrategy } from '../services/paperTradingEngine';
import { marketDataSimulator } from '../services/marketDataSimulator';
import { paperWalletService } from '../services/paperWalletService';

console.log('🚀 Starting Manual Paper Trading Simulation...\n');

// Test Strategy: Buy when price > 18000, sell when price < 17900
const testStrategy: ExecutableStrategy = {
    id: 'MANUAL-TEST-1',
    name: 'Manual Test Strategy',
    description: 'Simple price threshold strategy for testing',
    symbol: 'NIFTY50',
    instrumentType: 'INDEX',
    timeframe: 'ONE_MINUTE',
    quantity: 100,
    orderType: 'MARKET',
    productType: 'INTRADAY',
    entryConditions: [
        {
            id: 'entry-1',
            indicatorType: 'PRICE',
            conditionType: 'GT',
            value: 18000,
            logic: 'AND',
        },
    ],
    exitConditions: [
        {
            id: 'exit-1',
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

// Event listeners
let activityCount = 0;
let orderCount = 0;
let positionCount = 0;

paperTradingEngine.on('activity', (event) => {
    activityCount++;
    console.log(`[${activityCount}] ${event.type}: ${event.message}`, event.data || '');
});

paperTradingEngine.on('orderCreated', (order) => {
    orderCount++;
    console.log(`\n✅ ORDER CREATED #${orderCount}:`, {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        status: order.status,
    });
});

paperTradingEngine.on('orderUpdated', (order) => {
    console.log(`\n📝 ORDER UPDATED:`, {
        id: order.id,
        status: order.status,
        filledPrice: order.filledPrice,
    });
});

paperTradingEngine.on('positionOpened', (position) => {
    positionCount++;
    console.log(`\n📍 POSITION OPENED #${positionCount}:`, {
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
    });
});

paperTradingEngine.on('statusChange', (status) => {
    console.log(`\n🔄 Engine status changed to: ${status}`);
});

// Add strategy
console.log('📋 Adding test strategy...');
paperTradingEngine.addStrategy(testStrategy);

// Start engine
console.log('▶️  Starting paper trading engine...\n');
paperTradingEngine.startEngine();

// Display wallet
const wallet = paperWalletService.getWallet();
console.log('💰 Initial Wallet:', {
    balance: `₹${wallet.balance.toFixed(2)}`,
    available: `₹${wallet.availableMargin.toFixed(2)}`,
    used: `₹${wallet.usedMargin.toFixed(2)}`,
});

console.log('\n⏱️  Simulation running... (will auto-stop in 60 seconds)');
console.log('📊  Watch the console for activity events\n');

// Auto-stop after 60 seconds
setTimeout(() => {
    console.log('\n⏹️  Stopping simulation...');
    paperTradingEngine.stopEngine();

    const finalWallet = paperWalletService.getWallet();

    console.log('\n📊 SIMULATION RESULTS:');
    console.log('====================');
    console.log(`Activity Events: ${activityCount}`);
    console.log(`Orders Created: ${orderCount}`);
    console.log(`Positions Opened: ${positionCount}`);
    console.log(`\nFinal Wallet:`);
    console.log(`  Balance: ₹${finalWallet.balance.toFixed(2)}`);
    console.log(`  Available: ₹${finalWallet.availableMargin.toFixed(2)}`);
    console.log(`  Used Margin: ₹${finalWallet.usedMargin.toFixed(2)}`);
    console.log(`  Realized P&L: ₹${finalWallet.realizedPnl.toFixed(2)}`);
    console.log(`  Unrealized P&L: ₹${finalWallet.unrealizedPnl.toFixed(2)}`);
    console.log(`  Total Equity: ₹${(finalWallet.balance + finalWallet.unrealizedPnl).toFixed(2)}`);

    const pnl = finalWallet.realizedPnl + finalWallet.unrealizedPnl;
    const pnlPercent = ((pnl / 100000) * 100).toFixed(2);
    console.log(`\n${pnl >= 0 ? '✅' : '❌'} Net P&L: ₹${pnl.toFixed(2)} (${pnlPercent}%)`);

    console.log('\n✅ Simulation complete!');
}, 60000);

// Export for console access
(window as any).paperTradingEngine = paperTradingEngine;
(window as any).paperWalletService = paperWalletService;
(window as any).marketDataSimulator = marketDataSimulator;

console.log('\n💡 Tip: You can access these objects from the console:');
console.log('   - paperTradingEngine');
console.log('   - paperWalletService');
console.log('   - marketDataSimulator');
