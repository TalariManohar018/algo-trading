# Paper Trading Implementation - Complete

## 🎯 Overview

This implementation provides a **frontend-first paper trading system** that simulates real trading without risking capital. The system is designed to be modular and replaceable - all services use Promise-based APIs that can later be swapped with backend REST calls.

## 📁 Architecture

### Core Services

```
src/services/
├── marketDataSimulator.ts      # 1-min candle generator with configurable volatility
├── paperOrderService.ts         # Order lifecycle simulation (CREATED → PLACED → FILLED)
├── paperPositionService.ts      # Position management with P&L tracking
├── paperWalletService.ts        # Virtual capital management (₹100,000 initial)
├── conditionEvaluator.ts        # Strategy condition evaluation engine
└── paperTradingEngine.ts        # Main coordinator - glues everything together
```

### UI Components

```
src/components/
├── EngineControl.tsx            # Start/Stop trading engine with status
├── ActivityFeed.tsx             # Real-time event stream feed
├── WalletCard.tsx               # Balance, margin, P&L display
└── OrdersBadge.tsx              # In-progress orders counter
```

### Context Integration

```
src/context/
└── TradingContext.tsx           # Single source of truth for all trading state
                                  # Integrates with paper trading engine events
```

## 🔧 Features

### Market Data Simulation
- **1-minute candles** generated in real-time
- **Configurable volatility** (default: 0.5%)
- **Multi-symbol support** (default: NIFTY50)
- **EventEmitter-based** for real-time updates

### Order Lifecycle
- **Creation delay**: Instant (CREATED status)
- **Placement delay**: 200ms (CREATED → PLACED)
- **Fill delay**: 500ms (PLACED → FILLED)
- **Slippage**: ~0.1% on market orders
- **Rejection rate**: ~5% random rejections
- **Order types**: MARKET, LIMIT

### Position Management
- **Automatic position opening** on order fill
- **Real-time unrealized P&L** updates on each candle
- **Position closing** on exit signal or manual close
- **Realized P&L** calculation on position close
- **FIFO accounting** for position tracking

### Wallet Management
- **Initial capital**: ₹100,000
- **Margin reservation**: 20% of position value
- **Capital availability checks** before order creation
- **Real-time balance updates** on P&L changes
- **LocalStorage persistence** for durability

### Strategy Execution
- **Condition evaluation** (GT, LT, EQ, CROSS_ABOVE, CROSS_BELOW)
- **Indicator support** (RSI, EMA, SMA, PRICE, VOLUME)
- **Entry/exit signals** based on strategy rules
- **Max trades per day** enforcement
- **Trading window** enforcement (9:15 AM - 3:30 PM)
- **Square-off time** (3:25 PM automatic close)

### Risk Management
- **Daily loss limits**
- **Max trades per day**
- **Position size limits**
- **Stop-loss / take-profit**
- **Emergency kill switch**

## 🚀 Getting Started

### 1. Start the Frontend

```bash
cd algo-trading-frontend
npm run dev
```

Frontend runs on http://localhost:5173

### 2. Test Paper Trading

#### Option A: Manual Browser Test

Open browser console and run:

```javascript
// Load test script
const script = document.createElement('script');
script.type = 'module';
script.src = '/src/test/manualSimulation.ts';
document.body.appendChild(script);
```

This starts a 60-second simulation with console output.

#### Option B: UI Testing

1. **Navigate to Dashboard**
2. **Click "Start Engine"** button
3. **Watch Activity Feed** for real-time events
4. **Monitor Wallet Card** for balance and P&L updates

### 3. Create a Strategy

1. Go to **Strategy Builder** page
2. Fill in strategy details:
   - Name: "Test Strategy"
   - Symbol: "NIFTY50"
   - Timeframe: "1m"
3. Add **Entry Conditions**:
   - Price > 18000
4. Add **Exit Conditions**:
   - Price < 17900
5. Click **"Preview JSON"** to see executable format
6. **Save** strategy
7. Strategy will be activated in the dashboard

## 📊 Data Flow

```
┌─────────────────────┐
│ Market Data         │
│ Simulator           │
│ (1-min candles)     │
└──────────┬──────────┘
           │ emit('candle')
           ▼
┌─────────────────────┐
│ Paper Trading       │
│ Engine              │
│ - Evaluate strategy │
│ - Generate signals  │
└──────────┬──────────┘
           │ emit('orderCreated')
           ▼
┌─────────────────────┐
│ Paper Order         │
│ Service             │
│ - Place order       │
│ - Fill order        │
└──────────┬──────────┘
           │ emit('orderUpdated')
           ▼
┌─────────────────────┐
│ Paper Position      │
│ Service             │
│ - Open position     │
│ - Track P&L         │
└──────────┬──────────┘
           │ emit('positionOpened')
           ▼
┌─────────────────────┐
│ Trading Context     │
│ - Update state      │
│ - Persist to        │
│   localStorage      │
└──────────┬──────────┘
           │ render()
           ▼
┌─────────────────────┐
│ React Components    │
│ - Dashboard         │
│ - Activity Feed     │
│ - Wallet Card       │
└─────────────────────┘
```

## 🔄 Event System

The paper trading system uses an EventEmitter pattern for loose coupling:

### Engine Events

```typescript
paperTradingEngine.on('activity', (event: ActivityEvent) => {
  console.log(event.type, event.message);
});

paperTradingEngine.on('orderCreated', (order: Order) => {
  // Handle new order
});

paperTradingEngine.on('positionOpened', (position: Position) => {
  // Handle new position
});

paperTradingEngine.on('statusChange', (status: EngineStatus) => {
  // Handle engine status change
});
```

### Activity Event Types

- `CANDLE`: New market data candle
- `SIGNAL`: Entry/exit signal generated
- `ORDER`: Order created
- `FILL`: Order filled
- `POSITION`: Position opened
- `EXIT`: Position closed
- `ALERT`: Warning message
- `ERROR`: Error occurred

## 💾 Data Persistence

All trading data is persisted to localStorage:

- `paper_wallet`: Wallet state (balance, margin, P&L)
- `trading_orders`: All orders
- `trading_positions`: All positions
- `trading_trades`: All completed trades
- `trading_activity`: Activity log (last 100 events)
- `trading_strategies`: Active strategies

### Reset State

To clear all data:

```javascript
localStorage.removeItem('paper_wallet');
localStorage.removeItem('trading_orders');
localStorage.removeItem('trading_positions');
localStorage.removeItem('trading_trades');
localStorage.removeItem('trading_activity');
localStorage.removeItem('trading_strategies');
location.reload();
```

## 🧪 Testing

### Unit Tests

```typescript
// Test condition evaluator
import { conditionEvaluator } from './conditionEvaluator';

const candles = generateCandles([100, 101, 102, 103, 104]);
const condition = {
  indicatorType: 'PRICE',
  conditionType: 'GT',
  value: 103,
};

const result = conditionEvaluator.evaluate(condition, candles);
// result === true
```

### Integration Test

Run the full simulation:

```typescript
import { paperTradingEngine } from './paperTradingEngine';

const strategy = { /* ... */ };
paperTradingEngine.addStrategy(strategy);
await paperTradingEngine.startEngine();

// Wait 60 seconds
setTimeout(() => {
  paperTradingEngine.stopEngine();
  console.log('Simulation complete');
}, 60000);
```

See `PAPER_TRADING_TESTING.md` for detailed testing guide.

## 🔌 Backend Integration (Future)

The service layer is designed to be easily replaceable:

### Current (Frontend Mock)

```typescript
// paperOrderService.ts
export const createOrder = async (params: OrderParams): Promise<Order> => {
  return new Promise((resolve) => {
    const order = { id: generateId(), ...params, status: 'CREATED' };
    resolve(order);
  });
};
```

### Future (Backend REST API)

```typescript
// orderService.ts
export const createOrder = async (params: Order Params): Promise<Order> => {
  const response = await axios.post('/api/orders', params);
  return response.data;
};
```

**Same interface, different implementation!**

## 📈 Next Steps

### Phase 1: Paper Trading (70% ✅)
- ✅ Market data simulator
- ✅ Order lifecycle simulation
- ✅ Position management
- ✅ Wallet service
- ✅ Condition evaluator
- ✅ Trading engine
- ✅ UI components
- ✅ TradingContext integration

### Phase 2: Backend Integration (30%)
- 🔄 Replace mock services with REST APIs
- 🔄 Real-time WebSocket for market data
- 🔄 Backend order management
- 🔄 Backend position tracking
- 🔄 Database persistence

### Phase 3: Broker Integration (0%)
- ⭕ Zerodha Kite API integration
- ⭕ Real market data feed
- ⭕ Real order execution
- ⭕ Production safety checks

## 🛠️ Configuration

### Market Data Simulator

```typescript
const simulator = new MarketDataSimulator({
  symbols: ['NIFTY50', 'BANKNIFTY'],
  basePrice: 18000,
  volatilityPercent: 0.5,  // 0.5% volatility
  intervalMs: 60000,       // 1 minute
});
```

### Paper Wallet

```typescript
const wallet = {
  initialCapital: 100000,
  marginPercent: 20,  // 20% margin required
};
```

### Risk Limits

```typescript
const riskConfig = {
  maxLossPerTrade: 500,
  maxProfitTarget: 1000,
  stopLossPercent: 1,
  takeProfitPercent: 2,
  maxTradesPerDay: 5,
};
```

## 🐛 Debugging

### Enable Logging

```javascript
// In browser console
paperTradingEngine.on('activity', console.log);
paperTradingEngine.on('orderCreated', console.log);
paperTradingEngine.on('positionOpened', console.log);
```

### Inspect State

```javascript
// View wallet
paperWalletService.getWallet();

// View candle history
marketDataSimulator.getLatestCandle('NIFTY50');

// View engine status
paperTradingEngine.getStatus();
```

## 📝 Known Limitations

1. **No real market data** - simulated candles only
2. **No broker connection** - all trades are virtual
3. **Simplified indicators** - RSI, EMA, SMA only
4. **No order book depth** - market orders fill at current price
5. **No partial fills** - orders fill completely or not at all
6. **Single timeframe** - 1-minute candles only

## 🆘 Troubleshooting

### Engine won't start

- Check if strategies are loaded: `paperTradingEngine.strategies.size > 0`
- Check browser console for errors
- Verify TradingContext is providing engine status

### Orders not filling

- Check wallet has sufficient capital
- Verify order price is reasonable
- Check for rejection (5% random rejection rate)

### P&L not updating

- Ensure positions are OPEN status
- Verify candles are being generated
- Check position symbol matches candle symbol

## 📄 License

MIT

## 👥 Contributors

- Solo project by **manoh**
- GitHub Copilot assisted implementation

---

**Status**: 🟢 70% Complete - Paper Trading Core Implemented

**Next Milestone**: Backend integration with REST APIs
