# Paper Trading System - Testing Guide

## Quick Start

### Manual Browser Test

1. **Start the frontend**:
   ```bash
   npm run dev
   ```

2. **Open browser** to `http://localhost:5173`

3. **Open browser console** (F12)

4. **Run the following code** to start a 60-second simulation:

```javascript
// Load the test script
const script = document.createElement('script');
script.type = 'module';
script.src = '/src/test/manualSimulation.ts';
document.body.appendChild(script);
```

The simulation will:
- Generate 1-minute candles for NIFTY50
- Evaluate a simple strategy (Buy > 18000, Sell < 17900)
- Create orders and positions
- Show real-time activity in the console
- Display final results after 60 seconds

### UI Testing

1. **Start the engine from Dashboard**:
   - Navigate to Dashboard page
   - Click "Start Engine" button
   - Watch the Activity Feed for live events

2. **Create a strategy**:
   - Go to "Strategy Builder" page
   - Fill in strategy details
   - Add entry/exit conditions
   - Click "Preview JSON" to see the executable format
   - Save the strategy

3. **Monitor trading**:
   - **Wallet Card**: Shows balance, margin usage, P&L
   - **Orders Badge**: Shows in-progress orders count
   - **Activity Feed**: Real-time event stream
   - **Engine Control**: Start/stop trading engine

## What to Expect

### Console Output
```
🚀 Starting Manual Paper Trading Simulation...

📋 Adding test strategy...
▶️  Starting paper trading engine...

💰 Initial Wallet: {
  balance: '₹100000.00',
  available: '₹100000.00',
  used: '₹0.00'
}

[1] CANDLE: New candle: NIFTY50 @ ₹18025.45
[2] SIGNAL: Entry signal: MANUAL-TEST-1
[3] ORDER: Order created: BUY 100 NIFTY50 @ MARKET

✅ ORDER CREATED #1: {
  id: 'ORD-1234567890',
  symbol: 'NIFTY50',
  side: 'BUY',
  quantity: 100,
  status: 'CREATED'
}

📝 ORDER UPDATED: {
  id: 'ORD-1234567890',
  status: 'PLACED'
}

📝 ORDER UPDATED: {
  id: 'ORD-1234567890',
  status: 'FILLED',
  filledPrice: 18026.32
}

📍 POSITION OPENED #1: {
  id: 'POS-1234567890',
  symbol: 'NIFTY50',
  side: 'LONG',
  quantity: 100,
  entryPrice: 18026.32
}
```

### Final Results
```
📊 SIMULATION RESULTS:
====================
Activity Events: 45
Orders Created: 3
Positions Opened: 3

Final Wallet:
  Balance: ₹100450.25
  Available: ₹94500.00
  Used Margin: ₹5500.00
  Realized P&L: ₹350.25
  Unrealized P&L: ₹100.00
  Total Equity: ₹100550.25

✅ Net P&L: ₹450.25 (0.45%)

✅ Simulation complete!
```

## Testing Scenarios

### 1. Condition Evaluation
Test that conditions are evaluated correctly:
- Price thresholds (GT, LT, EQ)
- Crossovers (CROSS_ABOVE, CROSS_BELOW)
- Indicators (RSI, EMA, SMA)

### 2. Order Lifecycle
Test the full order flow:
- Order creation (CREATED)
- Order placement with delay (PLACED)
- Order filling with slippage (FILLED)
- Random rejections (~5%)

### 3. Position Management
Test position tracking:
- Position opening on order fill
- Unrealized P&L updates on each candle
- Position closing on exit signal
- Realized P&L calculation

### 4. Wallet Management
Test capital management:
- Initial capital (₹100,000)
- Margin reservation (20% of position value)
- Capital availability checks
- P&L updates

### 5. Risk Management
Test safety limits:
- Max trades per day
- Trading window enforcement
- Square-off time
- Emergency stop

## Debugging

### Enable Detailed Logging

In browser console:
```javascript
// See all events
paperTradingEngine.on('activity', (e) => console.log(e));
paperTradingEngine.on('orderCreated', (o) => console.log('Order:', o));
paperTradingEngine.on('positionOpened', (p) => console.log('Position:', p));

// Check wallet
const wallet = paperWalletService.getWallet();
console.log('Wallet:', wallet);

// Get latest candle
marketDataSimulator.on('candle', (c) => console.log('Candle:', c));
```

### Check localStorage

All data is persisted in localStorage:
```javascript
// View stored data
JSON.parse(localStorage.getItem('paper_wallet'))
JSON.parse(localStorage.getItem('trading_orders'))
JSON.parse(localStorage.getItem('trading_positions'))
JSON.parse(localStorage.getItem('trading_activity'))
```

### Reset State

To start fresh:
```javascript
// Clear all paper trading data
localStorage.removeItem('paper_wallet');
localStorage.removeItem('trading_orders');
localStorage.removeItem('trading_positions');
localStorage.removeItem('trading_trades');
localStorage.removeItem('trading_activity');
localStorage.removeItem('trading_strategies');

// Reload page
location.reload();
```

## Known Behaviors

1. **Market Data**: Simulated with configurable volatility
2. **Slippage**: ~0.1% on market orders
3. **Rejection Rate**: ~5% of orders randomly rejected
4. **Delays**: 
   - Order placement: 200ms
   - Order fill: 500ms
5. **Candles**: Generated every 60 seconds (1-minute timeframe)

## Next Steps

After confirming the paper trading system works:

1. **Replace with Backend APIs**: The service layer uses Promises and can be swapped with REST API calls
2. **Add Real Broker Integration**: Connect to Zerodha Kite API
3. **Add More Indicators**: Expand conditionEvaluator with MACD, Bollinger Bands, etc.
4. **Improve UI**: Add charts, more detailed position views, strategy analytics

---

**Status**: 🟢 Paper Trading Core - 70% Complete
- ✅ Market data simulator
- ✅ Order lifecycle simulation
- ✅ Position management
- ✅ Wallet service
- ✅ Condition evaluator
- ✅ Trading engine
- ✅ TradingContext integration
- ✅ UI components
- ✅ Manual testing guide
