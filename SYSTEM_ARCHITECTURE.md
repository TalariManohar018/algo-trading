# Algo Trading Platform - System Architecture

## Current Status: ~85-90% Complete

### BACKEND (Spring Boot 3.2.0 + Java 17)

#### ✅ Core Engine
- **TradingEngineService**: Scheduled trading engine running every 1 minute
  - Evaluates running strategies
  - Generates BUY/SELL signals
  - Executes orders via broker service
  - Manages position lifecycle
  - Enforces risk limits
  - Auto-squares off positions on risk breach

#### ✅ Broker Integration Layer
- **BrokerService Interface**: Abstraction for broker operations
- **MockBrokerService** (Active): Paper trading implementation with:
  - Simulated order placement
  - Realistic slippage (0-0.2%)
  - Random rejection (5%)
  - Mock market prices with volatility
  - Instant fills for market orders
  
- **ZerodhaBrokerService** (Placeholder): Ready for Kite Connect integration
- **AngelBrokerService** (Placeholder): Ready for SmartAPI integration

#### ✅ Database Entities
- User (authentication)
- Strategy (with conditions)
- Order (full lifecycle)
- Position (open/closed tracking)
- Trade (execution history)
- Wallet (balance, margin, PnL)
- RiskState (daily limits)
- EngineState (engine status per user)

#### ✅ REST APIs
- **/api/auth** - JWT authentication (login/register)
- **/api/strategies** - CRUD operations
- **/api/orders** - Order management
- **/api/positions** - Position tracking
- **/api/trades** - Trade history
- **/api/wallet** - Balance & margin
- **/api/engine** - Engine control (start/stop/emergency-stop)

#### ✅ Services
- AuthService
- StrategyService
- OrderService
- PositionService
- WalletService
- RiskManagementService
- ConditionEngineService
- TradingEngineService
- MockBrokerService

#### ✅ Security
- Spring Security + JWT
- Password encryption (BCrypt)
- Token-based authentication
- Protected endpoints

#### ✅ Database
- H2 in-memory (development)
- JPA/Hibernate
- Auto-generated schema
- Transaction management

---

### FRONTEND (React 18 + Vite + TypeScript)

#### ✅ Pages
- /dashboard - Trading command center
- /strategies - Strategy management
- /builder - Visual strategy builder
- /backtest - Backtesting interface
- /trades - Trade history
- /positions - Open positions tracker
- /settings - Configuration
- /login & /signup - Authentication

#### ✅ Trading Engine (Frontend)
- TradingEngine with 1-minute tick loop
- Strategy evaluation
- Condition engine (EMA, RSI, SMA, MACD, etc.)
- Order lifecycle management
- Position tracking
- Risk enforcement
- Market data simulator

#### ✅ Services
- tradingEngine.ts
- orderService.ts
- positionService.ts
- marketDataService.ts
- conditionEngine.ts
- walletManager.ts
- riskManager.ts
- strategyService.ts

#### ✅ Context Providers (Single Source of Truth)
- TradingContext (orders, positions, trades, wallet, risk, engine state)
- AuthContext
- SettingsContext
- ErrorContext
- LoadingContext

#### ✅ UI Components
- Dashboard with engine controls
- OrderBook (active orders)
- EngineStatusPanel (live metrics)
- StrategyPerformance analytics
- ActivityFeed (real-time events)
- RiskPanel
- AccountSummary
- Charts & visualizations

---

### SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React + Vite + TypeScript + TailwindCSS        │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  TradingContext (Single Source of Truth)    │ │
│  │  • Engine State  • Orders   • Positions     │ │
│  │  • Trades        • Wallet   • Risk State    │ │
│  └────────────────────────────────────────────┘ │
│                        ↕                         │
│  ┌────────────────────────────────────────────┐ │
│  │        Trading Engine (Frontend)            │ │
│  │  • 1-min tick loop                          │ │
│  │  • Strategy evaluation                      │ │
│  │  • Signal generation                        │ │
│  │  • Order management                         │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ HTTP/REST APIs
                       ↕
┌──────────────────────────────────────────────────┐
│                    BACKEND                        │
│         Spring Boot 3.2.0 + Java 17              │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │     TradingEngineService (@Scheduled)        ││
│  │  • 1-min tick loop                           ││
│  │  • Strategy evaluation                       ││
│  │  • Signal generation                         ││
│  │  • Order execution via BrokerService         ││
│  │  • Position lifecycle management             ││
│  │  • Risk enforcement & auto square-off        ││
│  └──────────────────────────────────────────────┘│
│                        ↕                          │
│  ┌──────────────────────────────────────────────┐│
│  │           BrokerService Layer                 ││
│  │  • Interface abstraction                      ││
│  │  • MockBroker (paper trading) ✅             ││
│  │  • ZerodhaBroker (placeholder) ⏳            ││
│  │  • AngelBroker (placeholder) ⏳              ││
│  └──────────────────────────────────────────────┘│
│                        ↕                          │
│  ┌──────────────────────────────────────────────┐│
│  │         Database (H2 / PostgreSQL)           ││
│  │  • Users      • Strategies  • Orders         ││
│  │  • Positions  • Trades      • Wallet         ││
│  │  • RiskState  • EngineState                  ││
│  └──────────────────────────────────────────────┘│
└───────────────────────────────────────────────────┘
```

---

### TRADING ENGINE FLOW

#### 1. Engine Start
```
User → Dashboard → Click "Start Engine"
       ↓
Frontend → POST /api/engine/start
       ↓
Backend → Check risk state
       ↓
Backend → Create/Update EngineState (RUNNING)
       ↓
TradingEngineService → Scheduled tick begins
```

#### 2. Engine Tick (Every 1 Minute)
```
TradingEngineService.tick()
  ↓
Check risk limits
  ↓
Get all RUNNING strategies
  ↓
For each strategy:
  ↓
  Fetch current market price (via BrokerService)
  ↓
  Calculate indicators (EMA, RSI, MACD, etc.)
  ↓
  Evaluate entry conditions
    ↓ (Signal generated)
    Create Order (CREATED)
    ↓
    Place via BrokerService
    ↓
    Update Order (FILLED/REJECTED)
    ↓
    If FILLED → Create Position
  ↓
  Evaluate exit conditions (if position open)
    ↓ (Exit signal)
    Create Sell Order
    ↓
    Close Position
    ↓
    Update Wallet (realized PnL)
    ↓
    Update RiskState (daily loss/trade count)
  ↓
Update unrealized PnL for all open positions
```

#### 3. Risk Enforcement
```
On each tick:
  Check daily loss vs max loss limit
  Check daily trade count vs max trades
  
If breached:
  Lock engine (status = LOCKED)
  Square off all open positions
  Block new orders
  Log CRITICAL event
```

---

### ORDER LIFECYCLE

```
CREATED → PLACED → FILLED → CLOSED
         ↓
       REJECTED
```

**States:**
- CREATED: Order created by strategy
- PLACED: Sent to broker
- FILLED: Executed by broker
- REJECTED: Broker declined (insufficient margin, circuit breaker, etc.)
- CLOSED: Position closed

**Simulations:**
- Slippage: 0-0.2%
- Latency: Instant (mock)
- Rejection: 5% random

---

### RISK MANAGEMENT

#### Hard Limits (Non-Negotiable)
- Max loss per day: ₹5,000 (configurable)
- Max trades per day: 10 (configurable)
- Max capital per trade: 20% (configurable)

#### Enforcement
- Pre-trade checks: Block order if limits breached
- Post-trade updates: Track cumulative loss and trade count
- Auto lock: Engine stops on breach
- Auto square-off: All positions closed immediately

---

### LIVE TRADING READINESS

#### ✅ Architecture Ready
- BrokerService interface defined
- Order flow abstracted
- Position management complete
- Risk enforcement in place

#### ⏳ Pending for Live Trading
- Zerodha Kite Connect SDK integration
- Angel SmartAPI integration
- Real-time market data subscription
- OAuth/TOTP authentication for brokers
- Production database (PostgreSQL)
- Error handling for broker API failures
- Order status polling/webhooks
- Circuit breaker patterns

---

### NEXT STEPS TO GO LIVE

1. **Choose Broker**: Zerodha or Angel One
2. **Add SDK**: Include broker SDK dependency in pom.xml
3. **Implement Adapter**:
   - Replace @Primary from MockBroker to chosen broker
   - Implement authentication flow
   - Map order types and statuses
   - Handle API rate limits
4. **Test in Sandbox**: Use broker's test environment
5. **Deploy**: Production server + PostgreSQL
6. **Monitor**: Set up logging, alerts, and dashboards
7. **Go Live**: Start with minimal capital

---

### CURRENT STATE
- ✅ Frontend: 100% (complete trading UI)
- ✅ Backend: 90% (APIs, engine, mock broker)
- ⏳ Live Trading: 0% (broker integration pending)

**Total Completion: ~85-90%**

---

### FILES STRUCTURE

#### Backend
```
src/main/java/com/algo/
├── AlgoTradingApplication.java (@EnableScheduling)
├── config/
│   ├── SecurityConfig.java
│   └── JwtAuthenticationFilter.java
├── controller/
│   ├── AuthController.java
│   ├── StrategyController.java
│   ├── OrderController.java
│   ├── PositionController.java
│   ├── TradeController.java
│   ├── WalletController.java
│   └── EngineController.java ← NEW
├── model/
│   ├── User.java
│   ├── Strategy.java
│   ├── Condition.java
│   ├── Order.java
│   ├── Position.java
│   ├── Trade.java
│   ├── Wallet.java
│   ├── RiskState.java
│   └── EngineState.java ← NEW
├── repository/
│   ├── UserRepository.java
│   ├── StrategyRepository.java
│   ├── OrderRepository.java
│   ├── PositionRepository.java
│   ├── TradeRepository.java
│   ├── WalletRepository.java
│   ├── RiskStateRepository.java
│   └── EngineStateRepository.java ← NEW
├── service/
│   ├── AuthService.java
│   ├── StrategyService.java
│   ├── OrderService.java
│   ├── PositionService.java
│   ├── WalletService.java
│   ├── RiskManagementService.java
│   ├── ConditionEngineService.java
│   ├── TradingEngineService.java ← NEW
│   └── broker/
│       ├── BrokerService.java ← NEW (interface)
│       ├── OrderStatusResponse.java
│       ├── MockBrokerService.java ← NEW (@Primary)
│       ├── ZerodhaBrokerService.java ← NEW (placeholder)
│       └── AngelBrokerService.java ← NEW (placeholder)
├── enums/
│   ├── OrderStatus.java
│   ├── PositionStatus.java
│   ├── StrategyStatus.java
│   ├── OrderSide.java
│   ├── OrderType.java
│   ├── IndicatorType.java
│   ├── ConditionType.java
│   └── EngineStatus.java ← NEW
└── util/
    └── IndicatorCalculator.java
```

#### Frontend
```
src/
├── services/
│   ├── tradingEngine.ts (complete)
│   ├── orderService.ts
│   ├── positionService.ts
│   ├── marketDataService.ts
│   ├── conditionEngine.ts
│   ├── walletManager.ts
│   ├── riskManager.ts
│   └── strategyService.ts
├── context/
│   ├── TradingContext.tsx (single source of truth)
│   ├── AuthContext.tsx
│   ├── SettingsContext.tsx
│   ├── ErrorContext.tsx
│   └── LoadingContext.tsx
├── components/
│   ├── OrderBook.tsx
│   ├── EngineStatusPanel.tsx
│   ├── StrategyPerformance.tsx
│   ├── ActivityFeed.tsx
│   ├── RiskPanel.tsx
│   └── ... (other components)
└── pages/
    ├── Dashboard.tsx (trading command center)
    ├── Strategies.tsx
    ├── Builder.tsx
    ├── Backtest.tsx
    ├── Trades.tsx
    ├── Positions.tsx
    └── Settings.tsx
```

---

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login

### Strategies
- GET /api/strategies
- POST /api/strategies
- GET /api/strategies/{id}
- PUT /api/strategies/{id}/activate
- PUT /api/strategies/{id}/deactivate
- DELETE /api/strategies/{id}

### Engine Control (NEW)
- POST /api/engine/start
- POST /api/engine/stop
- POST /api/engine/emergency-stop
- GET /api/engine/status

### Orders
- GET /api/orders
- POST /api/orders
- GET /api/orders/{id}

### Positions
- GET /api/positions
- GET /api/positions/open

### Trades
- GET /api/trades

### Wallet
- GET /api/wallet

---

## Environment Configuration

### application.yml
```yaml
trading:
  engine:
    tick-interval: 60000 # 1 minute
    max-trades-per-day: 10
  broker:
    mode: MOCK # MOCK, ZERODHA, ANGEL
```

### Frontend .env
```
VITE_API_BASE_URL=http://localhost:8080
```

---

## Security Notes

- All trading endpoints require JWT authentication
- Passwords are BCrypt hashed
- Token expiration: 24 hours
- H2 console enabled in dev mode
- CORS enabled for frontend origin

---

## Testing

### Backend Status
```bash
curl http://localhost:8080/api/engine/status
```

### Start Engine
```bash
curl -X POST http://localhost:8080/api/engine/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Orders
```bash
curl http://localhost:8080/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

**Built with:** Spring Boot 3.2.0 • Java 17 • React 18 • Vite • TypeScript • TailwindCSS • H2 Database
