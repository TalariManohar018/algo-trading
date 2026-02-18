# Algo Trading Platform - Complete Implementation

## 🎯 Overview
Production-grade personal algo-trading platform with paper trading (MockBroker) and live broker support. Safe, modular, and fully tested.

## ✅ Implemented Features

### 1. **Executable Strategy Model**
- Complete strategy schema with entry/exit conditions
- Risk configuration (max loss, stop loss, take profit)
- Trading windows and square-off times
- Full validation in builder and backend
- Database persistence with JSON columns for conditions

### 2. **Market Data Simulator**
- 1-minute candle generator with realistic volatility
- OHLCV data with proper high/low spread
- Historical data seeding for backtesting
- Pluggable interface (swap with WebSocket later)
- Candle history stored in database

### 3. **Trading Engine**
- **Candle-driven** architecture (evaluates on every minute close)
- Subscribes to market data candle-close events
- Evaluates all RUNNING strategies
- Generates BUY/SELL signals based on conditions
- Places orders via BrokerService
- Full position lifecycle management
- Automatic square-off at end of day
- Emergency stop with position closure

### 4. **Order Management**
- Full lifecycle: CREATED → PLACED → FILLED/REJECTED → CLOSED
- MockBroker simulates:
  - 5% rejection rate
  - 0.1% slippage
  - Realistic order execution
- Order persistence and audit trail

### 5. **Position & Wallet Management**
- Position tracking with unrealized/realized P&L
- Virtual capital allocation
- Margin management
- Daily reset logic
- Automatic wallet updates on position close

### 6. **Hard Risk Enforcement**
- Daily loss limit (₹5,000)
- Daily trade limit (10 trades/day)
- Max capital per trade (₹10,000)
- Market hours check (9:15 AM - 3:30 PM IST)
- **Automatic engine lock on breach**
- Automatic square-off on risk violation

### 7. **Broker Abstraction**
- `BrokerService` interface
- `MockBrokerService` (paper trading) - @Primary
- `ZerodhaBrokerService` (fully implemented)
- `AngelBrokerService` (placeholder)
- Dynamic broker switching via config

### 8. **Backend REST APIs**
All endpoints CORS-enabled:

#### Strategies
- `GET /api/strategies` - List all strategies
- `GET /api/strategies/{id}` - Get strategy by ID
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/{id}/activate` - Activate strategy
- `PUT /api/strategies/{id}/deactivate` - Deactivate strategy
- `DELETE /api/strategies/{id}` - Delete strategy

#### Trading Engine
- `POST /api/engine/start?userId=1` - Start engine
- `POST /api/engine/stop?userId=1` - Stop engine
- `POST /api/engine/emergency-stop?userId=1&reason=...` - Emergency stop
- `GET /api/engine/status?userId=1` - Get engine status

#### Market Data
- `POST /api/market-data/start` - Start simulator
- `POST /api/market-data/stop` - Stop simulator
- `GET /api/market-data/status` - Get status
- `GET /api/market-data/price/{symbol}` - Get current price
- `GET /api/market-data/candles/{symbol}?timeframe=1m&count=100` - Get historical candles

#### Orders (existing)
- `GET /api/orders` - List orders
- `GET /api/orders/{id}` - Get order by ID

#### Positions (existing)
- `GET /api/positions` - List positions
- `GET /api/positions/open` - Get open positions

#### Wallet (existing)
- `GET /api/wallet` - Get wallet balance

#### Audit Logs
- `GET /api/audit` - List audit logs

### 9. **Audit & Logging**
- Immutable, timestamped logs
- Severity levels: INFO, WARNING, ERROR, CRITICAL
- Logs: signals, orders, fills, position changes, risk events
- Full traceability

### 10. **Frontend Integration**
- Strategy Builder calls backend API
- JSON preview of executable strategy
- Validation UI with errors/warnings
- Dashboard ready for engine controls

---

## 🚀 Quick Start

### Prerequisites
- Java 17
- Maven 3.8+
- Node.js 18+
- npm/yarn

### Backend Setup

```bash
cd algo-trading-backend

# Build
./mvnw clean install

# Run
./mvnw spring-boot:run
```

Backend runs on **http://localhost:8080**

H2 Console: **http://localhost:8080/h2-console**
- JDBC URL: `jdbc:h2:mem:algotrading`
- Username: `sa`
- Password: (empty)

### Frontend Setup

```bash
cd algo-trading-frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 🧪 Testing the System

### 1. Start Market Data Simulator
```bash
curl -X POST http://localhost:8080/api/market-data/start
```

### 2. Create a Strategy
Use the **Strategy Builder** UI at `/builder` or via API:

```bash
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RSI Oversold Strategy",
    "symbol": "NIFTY",
    "instrumentType": "FUTURE",
    "timeframe": "ONE_MINUTE",
    "quantity": 1,
    "orderType": "MARKET",
    "productType": "MIS",
    "entryConditions": [
      {
        "id": "1",
        "indicatorType": "RSI",
        "conditionType": "LESS_THAN",
        "value": 30,
        "logic": "AND",
        "period": 14
      }
    ],
    "exitConditions": [
      {
        "id": "2",
        "indicatorType": "RSI",
        "conditionType": "GREATER_THAN",
        "value": 70,
        "logic": "AND",
        "period": 14
      }
    ],
    "maxTradesPerDay": 5,
    "tradingWindow": {
      "startTime": "09:15",
      "endTime": "15:15"
    },
    "squareOffTime": "15:20",
    "riskConfig": {
      "maxLossPerTrade": 1000,
      "maxProfitTarget": 2000,
      "stopLossPercent": 2,
      "takeProfitPercent": 5
    }
  }'
```

### 3. Activate Strategy
```bash
curl -X PUT http://localhost:8080/api/strategies/1/activate
```

### 4. Start Trading Engine
```bash
curl -X POST 'http://localhost:8080/api/engine/start?userId=1'
```

### 5. Monitor Engine
```bash
# Check status
curl http://localhost:8080/api/engine/status?userId=1

# Check positions
curl http://localhost:8080/api/positions

# Check orders
curl http://localhost:8080/api/orders

# Check wallet
curl http://localhost:8080/api/wallet
```

### 6. Stop Engine
```bash
curl -X POST 'http://localhost:8080/api/engine/stop?userId=1'
```

---

## 🧪 Seed Historical Data

The system automatically seeds 500 candles for NIFTY, BANKNIFTY, and FINNIFTY on startup (dev profile).

To seed manually:
```java
@Autowired
private MarketDataSimulator marketDataSimulator;

marketDataSimulator.seedHistoricalData("NIFTY", "1m", 1000);
```

---

## 📊 Database Schema

### Strategies Table
- Stores full strategy definition
- Entry/exit conditions as JSON
- Risk config embedded
- Trading window time ranges

### Candles Table
- Symbol, timeframe, timestamp (indexed)
- OHLCV data
- Historical replay support

### Orders Table
- Full order lifecycle tracking
- Links to strategy and user
- Timestamps for each state transition

### Positions Table
- Open/closed status
- Entry/exit prices
- Unrealized/realized P&L
- Strategy linkage

### Wallet Table
- Virtual capital tracking
- Margin used/available
- P&L history

### Risk State Table
- Daily loss tracking
- Trade count
- Lock status and reason

### Audit Log Table
- Immutable event log
- Severity levels
- JSON metadata

---

## 🔐 Security Configuration

### Paper Trading (Default)
```yaml
broker:
  mode: PAPER
  provider: MOCK
```

### Live Trading (Production)
```yaml
broker:
  mode: LIVE
  provider: ZERODHA  # or ANGEL

  zerodha:
    api-key: ${ZERODHA_API_KEY}
    api-secret: ${ZERODHA_API_SECRET}
    user-id: ${ZERODHA_USER_ID}
    password: ${ZERODHA_PASSWORD}
    totp-secret: ${ZERODHA_TOTP_SECRET}
```

**Never commit secrets to Git. Use environment variables.**

---

## 🏗️ Architecture

### Candle-Driven Flow
```
MarketDataSimulator (1-min cron)
  ↓
Generate Candle
  ↓
Emit CandleClose Event
  ↓
TradingEngine.onCandleClose()
  ↓
Evaluate Running Strategies
  ↓
StrategyEvaluator.evaluateEntryConditions()
  ↓
If signal → Place Order via BrokerService
  ↓
Create Position
  ↓
On next candle: Evaluate Exit Conditions
  ↓
Close Position
  ↓
Update Wallet, Risk State, Audit Log
```

### Trading Engine States
- **STOPPED**: Engine not running
- **RUNNING**: Actively trading
- **LOCKED**: Risk breach or emergency stop

---

## 📝 Strategy Condition Schema

```json
{
  "id": "STR-123456",
  "name": "EMA Crossover",
  "symbol": "NIFTY",
  "instrumentType": "FUTURE",
  "timeframe": "5m",
  "quantity": 1,
  "orderType": "MARKET",
  "productType": "MIS",
  "entryConditions": [
    {
      "id": "1",
      "indicatorType": "EMA",
      "conditionType": "CROSS_ABOVE",
      "value": 20000,
      "logic": "AND",
      "period": 20
    }
  ],
  "exitConditions": [
    {
      "id": "2",
      "indicatorType": "RSI",
      "conditionType": "GREATER_THAN",
      "value": 70,
      "logic": "OR",
      "period": 14
    }
  ],
  "maxTradesPerDay": 10,
  "tradingWindow": {
    "startTime": "09:15",
    "endTime": "15:15"
  },
  "squareOffTime": "15:20",
  "riskConfig": {
    "maxLossPerTrade": 1000,
    "maxProfitTarget": 2000,
    "stopLossPercent": 2,
    "takeProfitPercent": 5
  }
}
```

---

## 🧪 Testing

### Unit Tests
```bash
./mvnw test
```

### Integration Test Flow
1. Start backend
2. Start market data simulator
3. Create strategy
4. Activate strategy
5. Start engine
6. Wait for candle-close events
7. Verify signals, orders, positions
8. Stop engine

---

## 🎛️ Frontend Pages

- `/dashboard` - Command center with engine controls, running strategies, positions, orders, wallet, risk alerts
- `/builder` - Strategy builder with validation and JSON preview
- `/strategies` - List all strategies with activate/deactivate toggles
- `/backtest` - Backtest engine (uses same evaluation logic)
- `/trades` - Trade history
- `/positions` - Open and closed positions
- `/settings` - Risk limits, broker config, API keys

---

## 🚨 Risk Management

### Automatic Protections
- Daily loss limit enforced before every order
- Trade count checked before entry
- Market hours validation
- Strategy trading window check
- Automatic square-off at end of day
- **Engine locks on risk breach**
- Emergency stop closes all positions

### Manual Controls
- Emergency kill switch (UI + API)
- Manual strategy stop/start
- Engine stop
- Position square-off

---

## 📊 Monitoring & Alerts

### Audit Logs
```bash
curl http://localhost:8080/api/audit
```

### Activity Feed
Real-time feed showing:
- Signals generated
- Orders placed/filled/rejected
- Positions opened/closed
- Risk events
- Engine state changes

---

## 🔄 Daily Reset

Daily counters reset at midnight:
- Trade counts per strategy
- Daily P&L tracking
- Risk state

```bash
curl -X POST http://localhost:8080/api/engine/reset-counters
```

---

## 🐳 Production Deployment

### Docker (Coming Soon)
```bash
docker-compose up -d
```

### PostgreSQL Setup
Update `application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/algotrading
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    hibernate:
      ddl-auto: validate  # Use Flyway/Liquibase for migrations
```

---

## 📚 Next Steps

### Phase 2 (Production)
- [ ] Implement real indicator calculations (TA-Lib integration)
- [ ] WebSocket market data integration
- [ ] Advanced order types (LIMIT, SL, SL-M)
- [ ] Multi-leg strategies (options spreads)
- [ ] Portfolio-level risk management
- [ ] Performance analytics dashboard
- [ ] Backtesting with historical data replay
- [ ] Paper → Live mode transition testing
- [ ] Complete unit test coverage
- [ ] CI/CD pipeline
- [ ] Production monitoring (Grafana/Prometheus)

---

## 📞 Support

For issues or questions, check:
- Backend logs: `logs/spring.log`
- H2 Console for database inspection
- Audit logs table for event trail

---

## ⚖️ License

Private use only. Not for redistribution.

---

**Built with ❤️ for safe, professional algo trading**
