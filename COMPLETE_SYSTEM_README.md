# Personal Algorithmic Trading System
## Real-Money Paper-First Trading Platform

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://openjdk.java.net/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🚀 Quick Start

### Prerequisites
- **Java 17+** (OpenJDK or Oracle JDK)
- **Node.js 18+** and npm/yarn
- **Maven 3.8+**
- **Git**

### 1. Clone Repository
```bash
git clone <repository-url>
cd project
```

### 2. Start Backend (Spring Boot)
```bash
cd algo-trading-backend
mvnw clean install
mvnw spring-boot:run
```

Backend runs on: **http://localhost:8080**

### 3. Start Frontend (React + Vite)
```bash
cd algo-trading-frontend
npm install
npm run dev
```

Frontend runs on: **http://localhost:5173**

### 4. Login
- Email: `trader@algo.com`
- Password: `password123`

---

## 📚 System Overview

This is a **production-grade algorithmic trading system** designed for **personal use** with real money. It implements paper trading first with live-ready broker integrations.

### Key Features

✅ **Strategy Builder** - Visual strategy creation with entry/exit conditions  
✅ **Real-Time Execution Engine** - Candle-driven signal generation  
✅ **Order Management** - Full lifecycle: CREATED → PLACED → FILLED → CLOSED  
✅ **Position & PnL Tracking** - Real-time unrealized/realized P&L  
✅ **Wallet Management** - Virtual capital with margin allocation  
✅ **Hard Risk Enforcement** - Mandatory daily limits with auto-lockout  
✅ **Emergency Kill Switch** - Instant position square-off  
✅ **Paper Trading** - MockBroker with realistic slippage/latency  
✅ **Live-Ready Architecture** - Broker abstraction for Zerodha/Angel/Upstox  
✅ **Audit Logging** - Complete activity trail  
✅ **SSE Real-Time Updates** - Dashboard live data feed  

---

## 🏗️ Architecture

### Backend (Spring Boot)
```
algo-trading-backend/
├── src/main/java/com/algo/
│   ├── config/          # Security, CORS, DataSeeder
│   ├── controller/      # REST API endpoints
│   ├── dto/             # Data transfer objects
│   ├── enums/           # Status enums (OrderStatus, EngineStatus, etc.)
│   ├── model/           # JPA entities (Strategy, Order, Position, Wallet)
│   ├── repository/      # Spring Data JPA repositories
│   ├── service/         # Business logic
│   │   ├── broker/      # Broker abstraction (Mock, Zerodha, Angel)
│   │   ├── engine/      # Trading engine & strategy evaluator
│   │   └── market/      # Market data simulator & feed
│   └── util/            # Utilities
└── src/test/            # Unit & integration tests
```

### Frontend (React + Vite)
```
algo-trading-frontend/
├── src/
│   ├── api/             # Backend API clients
│   ├── components/      # Reusable UI components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Route pages
│   ├── services/        # Business logic services
│   └── types/           # TypeScript type definitions
```

---

## 🔧 Core Components

### 1. Trading Engine (`TradingEngineService`)
- **Candle-driven execution**: Processes 1-minute candles from market data service
- **Strategy evaluation**: Evaluates entry/exit conditions on each candle close
- **Signal generation**: Generates BUY/SELL signals
- **Order placement**: Places orders via broker service
- **Position management**: Opens/closes positions based on fills

**Engine States**:
- `STOPPED` - Engine is off
- `RUNNING` - Processing candles and evaluating strategies
- `PAUSED` - Temporarily suspended
- `LOCKED` - Risk breach, locked until manual reset

### 2. Strategy Model
```java
Strategy {
    id, name, symbol, timeframe,
    quantity, orderType, productType,
    entryConditions[], exitConditions[],
    maxTradesPerDay, tradingWindow, squareOffTime,
    riskLimits { maxLossPerDay, maxProfitPerDay, maxCapitalPerTrade }
}
```

**Status Flow**: `CREATED → RUNNING → STOPPED → PAUSED`

### 3. Order Management System
```java
Order {
    id, userId, strategyId, symbol, side, quantity, orderType,
    status, placedPrice, filledPrice, rejectedReason
}
```

**Lifecycle**: `CREATED → PLACED → FILLED | REJECTED → CLOSED`

### 4. Position & PnL Management
```java
Position {
    id, userId, strategyId, symbol, side, quantity,
    entryPrice, currentPrice, unrealizedPnl, realizedPnl,
    status (OPEN | CLOSED)
}
```

- **Unrealized P&L**: Updated on every candle
- **Realized P&L**: Locked on position close
- **Margin**: 20% of position value

### 5. Wallet Management
```java
Wallet {
    userId, balance, usedMargin, availableMargin,
    realizedPnl, unrealizedPnl
}
```

- Initial capital: ₹1,00,000
- Margin auto-allocated on order fill
- Margin released on position close
- Balance updated with realized P&L

### 6. Hard Risk Enforcement
**Authoritative server-side checks**:
- ❌ Max loss per day: ₹5,000
- ❌ Max trades per day: 10
- ❌ Max capital per trade: ₹10,000
- ❌ Market hours: 9:15 AM - 3:30 PM IST

**On breach**: Engine LOCKED → All positions squared off → Manual reset required

### 7. Market Data Service
- **MockBroker Mode**: Simulated 1-minute candles with volatility
- **Scheduled**: Cron-based candle generation at 0 seconds of every minute
- **Symbols**: NIFTY, BANKNIFTY, FINNIFTY, SENSEX
- **Historical Data**: Seeded for backtesting/replay

### 8. Broker Abstraction
```java
interface BrokerService {
    String placeOrder(Order order);
    void cancelOrder(String brokerOrderId);
    OrderStatusResponse getOrderStatus(String brokerOrderId);
    double getCurrentPrice(String symbol);
    List<Position> getPositions();
    void squareOffAll();  // Emergency use
}
```

**Implementations**:
- ✅ `MockBrokerService` - Paper trading with 5% rejection rate, 0.2% slippage
- 🔌 `ZerodhaBrokerService` - Placeholder for Zerodha Kite Connect
- 🔌 `AngelBrokerService` - Placeholder for Angel Broking SmartAPI

---

## 📡 REST API Endpoints

### Authentication
```
POST   /api/auth/register       Register new user
POST   /api/auth/login          Login and get JWT token
```

### Trading Engine
```
POST   /api/engine/start        Start trading engine
POST   /api/engine/stop         Stop trading engine
POST   /api/engine/emergency-stop  Emergency kill switch
GET    /api/engine/status       Get engine status
POST   /api/engine/reset-counters  Reset daily counters
```

### Strategies
```
GET    /api/strategies          Get all strategies
GET    /api/strategies/{id}     Get strategy by ID
POST   /api/strategies          Create new strategy
PUT    /api/strategies/{id}/activate    Activate strategy
PUT    /api/strategies/{id}/deactivate  Deactivate strategy
POST   /api/strategies/validate         Validate strategy
POST   /api/strategies/preview          Preview strategy JSON
DELETE /api/strategies/{id}     Delete strategy
```

### Orders
```
GET    /api/orders              Get all orders
GET    /api/orders/open         Get open orders
GET    /api/orders/{id}         Get order by ID
```

### Positions
```
GET    /api/positions           Get all positions
GET    /api/positions/open      Get open positions
```

### Wallet
```
GET    /api/wallet              Get wallet details
```

### Risk Management
```
GET    /api/risk/state          Get risk state
POST   /api/risk/unlock         Unlock risk engine
POST   /api/risk/reset          Reset daily limits
```

### Real-Time Updates
```
GET    /api/sse/subscribe       Subscribe to SSE (Server-Sent Events)
```

**SSE Events**:
- `engine_status` - Engine state changes
- `order_update` - Order status updates
- `position_update` - Position updates
- `candle_update` - New candle data
- `risk_alert` - Risk limit warnings
- `wallet_update` - Wallet changes

---

## 🧪 Testing

### Run All Tests
```bash
cd algo-trading-backend
mvnw test
```

### Unit Tests
- `StrategyEvaluatorTest` - Condition evaluation logic
- `WalletServiceTest` - Balance and margin calculations
- `RiskManagementServiceTest` - Risk limit enforcement

### Integration Tests
- `TradingEngineIntegrationTest` - Complete trading flow
  - Strategy creation
  - Engine start/stop
  - Signal generation
  - Order execution
  - Position management
  - Emergency stop

---

## 📊 Dashboard Features

### 1. Engine Control Panel
- **START** - Activate trading engine
- **STOP** - Gracefully stop engine
- **EMERGENCY KILL** - Instant position square-off

### 2. Account Summary
- Total balance
- Used margin
- Available margin
- Realized P&L
- Unrealized P&L

### 3. Running Strategies
- Active strategy count
- Daily trade count
- P&L per strategy

### 4. Open Positions
- Real-time unrealized P&L updates
- Entry price, current price
- Quantity, side (LONG/SHORT)

### 5. Order Book
- Live order status updates
- Placed, Filled, Rejected states
- Order history

### 6. Risk Panel
- Daily loss tracker
- Trade count tracker
- Risk breach alerts

### 7. Activity Feed
- Engine start/stop events
- Signal generation
- Order placement
- Position open/close
- Risk breaches

---

## ⚙️ Configuration

### Backend (`application.yml`)
```yaml
# Database
spring:
  datasource:
    url: jdbc:h2:mem:algotrading  # H2 for dev
    # For PostgreSQL production:
    # url: jdbc:postgresql://localhost:5432/algotrading
    # driver-class-name: org.postgresql.Driver

# JWT
jwt:
  secret: <your-secret-key>
  expiration: 86400000  # 24 hours

# Broker
broker:
  mode: PAPER  # PAPER or LIVE
  provider: MOCK  # MOCK, ZERODHA, ANGEL

# Zerodha (when using live)
broker:
  zerodha:
    api-key: ${ZERODHA_API_KEY}
    api-secret: ${ZERODHA_API_SECRET}
```

### Frontend (`src/api/config.ts`)
```typescript
export const API_BASE_URL = 'http://localhost:8080';
```

---

## 🛡️ Safety Features

### 1. Hard Risk Limits (Server-Side)
All risk checks are **authoritative** and **enforced in backend**.

### 2. Emergency Kill Switch
- Accessible from dashboard
- Squares off ALL positions immediately
- Locks engine until manual reset
- Creates audit log entry

### 3. Market Hours Enforcement
- Trades only allowed: 9:15 AM - 3:30 PM IST
- Weekend trading disabled
- Configurable per strategy

### 4. Square-Off Time
- Auto-close all positions at configured time
- Default: 3:15 PM (15 min before market close)
- Per-strategy configuration

### 5. Audit Logging
Every action logged with:
- User ID
- Event type
- Timestamp
- Metadata (prices, quantities, reasons)

---

## 🔄 Switching to Live Trading

### Step 1: Get Broker API Credentials
**Zerodha Kite Connect**:
1. Sign up at https://kite.trade/
2. Create API app
3. Get API key and secret

**Angel Broking**:
1. Open account at https://www.angelone.in/
2. Apply for SmartAPI
3. Get API credentials

### Step 2: Configure Backend
```yaml
broker:
  mode: LIVE  # Switch from PAPER to LIVE
  provider: ZERODHA  # or ANGEL

broker:
  zerodha:
    api-key: YOUR_API_KEY
    api-secret: YOUR_API_SECRET
    user-id: YOUR_USER_ID
```

### Step 3: Implement Live Broker Service
Uncomment and complete:
- `ZerodhaBrokerService.java`
- `AngelBrokerService.java`

Use official SDKs:
- Zerodha: https://github.com/zerodha/javakiteconnect
- Angel: https://github.com/angelbroking-github/smartapi-java

### Step 4: Test with Small Capital
⚠️ **CRITICAL**: Start with ₹10,000-20,000 max until fully tested.

---

## 📝 Development Workflow

### 1. Create Strategy
- Use Strategy Builder UI
- Define entry/exit conditions
- Set risk limits
- Validate and preview

### 2. Test in Paper Mode
- Activate strategy
- Start engine
- Monitor signals and execution
- Verify P&L calculations

### 3. Optimize
- Adjust conditions
- Refine risk limits
- Optimize trade frequency

### 4. Deploy to Live
- Switch broker mode
- Reduce position sizes initially
- Monitor closely for first week

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Java version
java -version  # Should be 17+

# Clean and rebuild
mvnw clean install -DskipTests
```

### Frontend can't connect to backend
- Check backend is running on port 8080
- Verify CORS is enabled in backend
- Check `API_BASE_URL` in frontend config

### Engine not processing candles
- Verify market data simulator is running
- Check engine status: `/api/engine/status`
- Ensure strategies are RUNNING status

### Orders getting rejected
- Check wallet has sufficient balance
- Verify risk limits not breached
- Check market hours (9:15 AM - 3:30 PM IST)

### SSE connection fails
- Check `/api/sse/subscribe` endpoint
- Verify EventSource browser support
- Check backend logs for connection errors

---

## 📂 Database Schema

### H2 Console
- URL: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:algotrading`
- Username: `sa`
- Password: (empty)

### Key Tables
- `users` - User accounts
- `strategies` - Trading strategies
- `orders` - Order records
- `positions` - Open/closed positions
- `trades` - Completed trades
- `wallets` - User balances
- `risk_states` - Daily risk tracking
- `audit_logs` - System activity log
- `candles` - Historical candle data
- `engine_states` - Engine status

---

## 🚀 Performance Optimization

### Backend
- Uses Spring scheduling for efficient candle generation
- Transactional integrity for all database operations
- Connection pooling configured
- Indexed queries on userId, strategyId, symbol

### Frontend
- React Context for state management
- Custom hooks for data fetching
- SSE for real-time updates (no polling)
- Optimized re-renders with React.memo

---

## 🔒 Security

- **JWT Authentication**: Stateless token-based auth
- **Password Hashing**: BCrypt with salt
- **CORS**: Configured for frontend origin
- **Input Validation**: Jakarta Validation annotations
- **SQL Injection Protection**: JPA parameterized queries
- **XSS Protection**: React automatic escaping

---

## 📈 Monitoring & Logging

### Log Levels
```yaml
logging:
  level:
    com.algo: DEBUG  # Application logs
    org.hibernate.SQL: DEBUG  # SQL queries
```

### Audit Log Viewer
Access from dashboard: **Settings → Audit Logs**

### Activity Feed
Real-time feed of:
- Engine events
- Signals
- Orders
- Positions
- Risk alerts

---

## 🤝 Contributing

This is a personal project not designed for SaaS or multi-user deployment.

---

## ⚠️ Disclaimers

1. **This software is provided AS-IS with NO WARRANTY**
2. **Trading involves substantial risk of loss**
3. **Past performance does not guarantee future results**
4. **Test thoroughly before using real money**
5. **Start with small capital**
6. **The author is not responsible for any financial losses**

---

## 📞 Support

For issues, check:
1. Logs: `algo-trading-backend/logs/`
2. H2 Console: http://localhost:8080/h2-console
3. Browser DevTools Network tab
4. Backend exception stack traces

---

## 📄 License

MIT License - See LICENSE file

---

## 🎯 Roadmap

### Phase 1 (Complete) ✅
- Strategy builder
- Trading engine
- Order management
- Position tracking
- Risk enforcement
- Paper trading

### Phase 2 (Work in Progress)
- [ ] Live broker integration (Zerodha/Angel)
- [ ] Advanced indicators (RSI, MACD, Bollinger Bands)
- [ ] Multi-timeframe analysis
- [ ] Backtesting with historical data
- [ ] Performance analytics dashboard

### Phase 3 (Future)
- [ ] Options trading support
- [ ] Bracket orders (stop-loss/target)
- [ ] Portfolio optimization
- [ ] Machine learning signal enhancement
- [ ] Mobile app (React Native)

---

**Built with ❤️ for algorithmic traders**

**Remember**: Always test with paper trading first. Never risk more than you can afford to lose.
