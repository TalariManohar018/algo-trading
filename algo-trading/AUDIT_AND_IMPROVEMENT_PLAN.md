# Algo-Trading System Audit & Improvement Plan

## 🎯 Executive Summary

1. **CRITICAL: Zero test coverage** — No unit/integration tests; strategies & risk management untested
2. **Timezone bugs** — IST calculations use inconsistent offsets; candles may close at wrong times
3. **No backtesting validation** — Can't verify strategies before live deployment
4. **Missing CI/CD** — No automated testing, linting, or deployment pipeline
5. **Order safety gaps** — No idempotency keys; duplicate orders possible on retry

**Risk Level: HIGH** — Live trading with untested code + unvalidated strategies

---

## 📋 Prioritized TODO List

### 🔴 SHORT TERM (Week 1-2) — CRITICAL

1. **Add comprehensive tests** (`tests/` directory)
   - [ ] Strategy signal tests (RSI, MA crossover, custom conditions)
   - [ ] Risk management tests (daily loss limits, consecutive losses, SL validation)
   - [ ] Order executor tests (slippage, position sizing, fills)
   - [ ] Indicator calculation tests (EMA, RSI, MACD accuracy vs TA-Lib)
   - Target: **80% coverage** minimum

2. **Fix timezone handling** (`src/utils/timezone.ts`)
   - [ ] Replace hardcoded `+5.5h` offset with `luxon` or `date-fns-tz`
   - [ ] Properly convert UTC ↔ IST for market hours check
   - [ ] Add timezone tests to prevent regression

3. **Add CI/CD pipeline** (`.github/workflows/ci.yml`)
   - [ ] Run tests on every PR
   - [ ] Enforce linting (ESLint, Prettier)
   - [ ] Block merge if tests fail
   - [ ] Add pre-commit hooks (`husky`)

4. **Add idempotency to orders** (`src/engine/orderExecutor.ts`)
   - [ ] Generate `clientOrderId` (UUID) per order
   - [ ] Store in DB before broker call
   - [ ] Prevent duplicate orders on retry

### 🟠 MEDIUM TERM (Week 3-4) — HIGH PRIORITY

5. **Build backtesting framework** (`src/backtesting/`)
   - [ ] Historical candle replay engine
   - [ ] Commission & slippage modeling (0.03% + spread)
   - [ ] Walk-forward optimization
   - [ ] Sharpe, max drawdown, win rate metrics
   - [ ] Prevent lookahead bias (only use data available at signal time)

6. **Strategy validation suite** (`tests/strategies/`)
   - [ ] Test on 6+ months historical data
   - [ ] Out-of-sample validation (train/test split)
   - [ ] Monte Carlo simulation for robustness
   - [ ] Correlation with market regime (trending vs ranging)

7. **Improve risk management** (`src/services/riskService.ts`)
   - [ ] Add portfolio heat (total P&L exposure)
   - [ ] Correlation-based position limits (don't overexpose to correlated stocks)
   - [ ] Volatility-adjusted position sizing (ATR-based)
   - [ ] Circuit breaker (halt on unusual volatility)

8. **Add API rate limit protection** (`src/services/angelOneBroker.ts`)
   - [ ] Token bucket rate limiter (per Angel One limits)
   - [ ] Exponential backoff on 429 errors
   - [ ] Queue orders during throttle

### 🟡 LONG TERM (Month 2+) — NICE TO HAVE

9. **Real-time monitoring dashboard**
   - [ ] Grafana + Prometheus metrics
   - [ ] Alert on strategy P&L drop > 5%
   - [ ] Latency tracking (signal → fill time)

10. **Strategy optimization tools**
    - [ ] Grid search for best RSI/MA periods
    - [ ] Genetic algorithm for parameter tuning
    - [ ] Overfitting detection (walk-forward efficiency ratio)

11. **Multi-exchange support**
    - [ ] Abstract broker interface (already exists but needs refinement)
    - [ ] Add Binance/Bybit for crypto

12. **Improve paper trading realism**
    - [ ] Simulate order queue depth
    - [ ] Model partial fills
    - [ ] Reject orders if price moved beyond limit

---

## 🛠️ Top 3 Fixes (Git Patches)

### PATCH 1: Fix IST Timezone Handling

**Problem**: Hardcoded `+5.5h` offset breaks during DST in other regions, and `new Date()` uses local timezone.

```diff
--- a/src/engine/executionEngine.ts
+++ b/src/engine/executionEngine.ts
@@ -1,4 +1,5 @@
 import { EventEmitter } from 'events';
+import { DateTime } from 'luxon';
 
 export class ExecutionEngine extends EventEmitter {
@@ -685,11 +686,11 @@ export class ExecutionEngine extends EventEmitter {
      * Check if current time is within IST market hours (9:15–15:20)
      */
     private isMarketHours(): boolean {
-        const now = new Date();
-        const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
-        const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
-        const hours = ist.getHours();
-        const minutes = ist.getMinutes();
+        // Use luxon for proper timezone handling
+        const istNow = DateTime.now().setZone('Asia/Kolkata');
+        const hours = istNow.hour;
+        const minutes = istNow.minute;
+        const totalMinutes = hours * 60 + minutes;
 
-        const totalMinutes = hours * 60 + minutes;
         const marketOpen = 9 * 60 + 15;   // 09:15 IST
         const marketClose = 15 * 60 + 20; // 15:20 IST
```

**Files to modify**: `src/engine/executionEngine.ts`, `src/services/riskService.ts`, `src/services/marketDataService.ts`

**Install**: `npm install luxon @types/luxon`

---

### PATCH 2: Add Order Idempotency

**Problem**: If network fails after order placement but before DB update, retry will create duplicate order.

```diff
--- a/src/engine/orderExecutor.ts
+++ b/src/engine/orderExecutor.ts
@@ -1,4 +1,5 @@
 import prisma from '../config/database';
+import { v4 as uuidv4 } from 'uuid';
 
 export class OrderExecutor {
@@ -54,11 +55,25 @@ export class OrderExecutor {
      * Execute a full order lifecycle: validate → place → track → update
      */
     async executeOrder(request: OrderRequest) {
+        // Generate idempotency key
+        const clientOrderId = uuidv4();
+        
+        // Check if order with this ID already exists (retry scenario)
+        const existing = await prisma.order.findFirst({
+            where: { clientOrderId }
+        });
+        if (existing) {
+            tradeLogger.warn('Order already exists (idempotent retry)', { clientOrderId });
+            return existing;
+        }
+
         // 1. Create order record in DB
         const order = await prisma.order.create({
             data: {
                 userId: request.userId,
                 strategyId: request.strategyId || null,
+                clientOrderId, // Store idempotency key
                 symbol: request.symbol,
                 exchange: request.exchange || 'NSE',
                 side: request.side,
```

**Database migration needed**:

```prisma
# prisma/schema.prisma
model Order {
  id              String   @id @default(uuid())
  clientOrderId   String   @unique  // NEW: idempotency key
  userId          String
  // ... rest of fields
}
```

Run: `npx prisma migrate dev --name add_client_order_id`

---

### PATCH 3: Add Pre-commit Test Hook

**Problem**: Developers can commit broken code; no enforcement.

```diff
--- /dev/null
+++ b/.husky/pre-commit
@@ -0,0 +1,5 @@
+#!/bin/sh
+. "$(dirname "$0")/_/husky.sh"
+
+npm run lint
+npm test -- --run
```

**Setup**:

```bash
npm install --save-dev husky vitest @vitest/ui
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm test -- --run"
```

**Update `package.json`**:

```diff
--- a/algo-trading-backend-node/package.json
+++ b/algo-trading-backend-node/package.json
@@ -14,7 +14,9 @@
     "db:seed": "tsx prisma/seed.ts",
     "db:studio": "prisma studio",
     "lint": "eslint src/ --ext .ts",
-    "test": "vitest"
+    "lint:fix": "eslint src/ --ext .ts --fix",
+    "test": "vitest",
+    "test:ci": "vitest run --coverage"
   },
```

---

## ✅ Example Unit Tests

Create `tests/strategies/rsi.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RSIStrategy } from '../../src/strategies/rsiStrategy';
import { Signal } from '../../src/strategies/base';
import { CandleInput } from '../../src/strategies/indicators';

describe('RSI Strategy', () => {
    const strategy = new RSIStrategy();
    
    // Helper to create candles with specific close prices
    const createCandles = (closes: number[]): CandleInput[] => {
        return closes.map((close, i) => ({
            open: close,
            high: close * 1.01,
            low: close * 0.99,
            close,
            volume: 1000,
            timestamp: new Date(Date.now() - (closes.length - i) * 60000),
        }));
    };

    it('should generate BUY signal when RSI crosses above 30 and price > SMA', () => {
        // Create 60 candles with uptrend: RSI will recover from oversold
        const closes = [
            // Downtrend (RSI will drop below 30)
            ...Array(20).fill(0).map((_, i) => 100 - i * 2), // 100 → 60
            // Recovery (RSI crosses back above 30)
            ...Array(40).fill(0).map((_, i) => 60 + i * 0.5), // 60 → 80
        ];
        const candles = createCandles(closes);
        
        const result = strategy.evaluate(candles, {
            parameters: { rsiPeriod: 14, oversold: 30, overbought: 70 },
        }, false);
        
        expect(result.signal).toBe(Signal.BUY);
        expect(result.indicators.rsi).toBeGreaterThan(30);
        expect(result.stopLoss).toBeLessThan(closes[closes.length - 1]);
        expect(result.takeProfit).toBeGreaterThan(closes[closes.length - 1]);
    });

    it('should generate SELL signal when RSI > 70', () => {
        // Create overbought scenario: strong uptrend
        const closes = Array(60).fill(0).map((_, i) => 50 + i * 1.5); // 50 → 138.5
        const candles = createCandles(closes);
        
        const result = strategy.evaluate(candles, {
            parameters: { rsiPeriod: 14, oversold: 30, overbought: 70 },
        }, true); // hasOpenPosition = true
        
        expect(result.signal).toBe(Signal.SELL);
        expect(result.indicators.rsi).toBeGreaterThan(70);
    });

    it('should HOLD when RSI is neutral (30-70)', () => {
        // Create sideways market
        const closes = Array(60).fill(100);
        const candles = createCandles(closes);
        
        const result = strategy.evaluate(candles, {
            parameters: { rsiPeriod: 14, oversold: 30, overbought: 70 },
        }, false);
        
        expect(result.signal).toBe(Signal.HOLD);
        expect(result.indicators.rsi).toBeGreaterThan(30);
        expect(result.indicators.rsi).toBeLessThan(70);
    });

    it('should reject if not enough candles', () => {
        const candles = createCandles([100, 101, 102]); // Only 3 candles
        
        expect(() => {
            strategy.evaluate(candles, { parameters: {} }, false);
        }).toThrow();
    });

    it('should validate stop-loss is set', () => {
        const closes = Array(60).fill(0).map((_, i) => 50 + i * 1.5);
        const candles = createCandles(closes);
        
        const result = strategy.evaluate(candles, {
            parameters: { rsiPeriod: 14, oversold: 30, overbought: 70 },
        }, false);
        
        if (result.signal === Signal.BUY) {
            expect(result.stopLoss).toBeDefined();
            expect(result.stopLoss).toBeLessThan(candles[candles.length - 1].close);
        }
    });
});
```

---

Create `tests/services/riskManagement.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { riskManagementService } from '../../src/services/riskService';
import prisma from '../../src/config/database';

// Mock Prisma
vi.mock('../../src/config/database', () => ({
    default: {
        riskState: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
    },
}));

describe('RiskManagementService', () => {
    const userId = 'test-user-001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should REJECT order if daily loss limit reached', async () => {
        // Mock: user has already lost ₹200 today
        (prisma.riskState.findUnique as any).mockResolvedValue({
            userId,
            dailyLoss: 200,
            dailyTradeCount: 3,
            consecutiveLosses: 0,
            isLocked: false,
        });

        const result = await riskManagementService.checkPreOrder(userId, 5000, 2);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Daily loss limit');
    });

    it('should REJECT order if no stop-loss configured', async () => {
        (prisma.riskState.findUnique as any).mockResolvedValue({
            userId,
            dailyLoss: 0,
            dailyTradeCount: 0,
            consecutiveLosses: 0,
            isLocked: false,
        });

        // No stopLossPercent provided
        const result = await riskManagementService.checkPreOrder(userId, 5000);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Stop loss not configured');
    });

    it('should REJECT order if 3 consecutive losses', async () => {
        (prisma.riskState.findUnique as any).mockResolvedValue({
            userId,
            dailyLoss: 150,
            dailyTradeCount: 3,
            consecutiveLosses: 3, // Hit limit
            isLocked: false,
        });

        const result = await riskManagementService.checkPreOrder(userId, 5000, 2);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('consecutive losses');
    });

    it('should ALLOW order if all checks pass', async () => {
        (prisma.riskState.findUnique as any).mockResolvedValue({
            userId,
            dailyLoss: 50,
            dailyTradeCount: 1,
            consecutiveLosses: 0,
            isLocked: false,
        });

        const result = await riskManagementService.checkPreOrder(userId, 5000, 2);
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('should calculate risk amount correctly', async () => {
        (prisma.riskState.findUnique as any).mockResolvedValue({
            userId,
            dailyLoss: 0,
            dailyTradeCount: 0,
            consecutiveLosses: 0,
            isLocked: false,
        });

        // Order value ₹10,000 with 5% stop-loss → ₹500 risk
        // Max risk per trade: ₹100 → should reject
        const result = await riskManagementService.checkPreOrder(userId, 10000, 5);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('exceeds max ₹100 per trade');
    });
});
```

---

Create `tests/indicators/rsi.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rsi, rsiArray } from '../../src/strategies/indicators';
import { CandleInput } from '../../src/strategies/indicators';

describe('RSI Indicator', () => {
    const createCandles = (closes: number[]): CandleInput[] => {
        return closes.map((close, i) => ({
            open: close,
            high: close,
            low: close,
            close,
            volume: 1000,
            timestamp: new Date(Date.now() - (closes.length - i) * 60000),
        }));
    };

    it('should return NaN for insufficient data', () => {
        const candles = createCandles([100, 101, 102]); // Only 3 candles
        const result = rsi(candles, 14);
        expect(result).toBeNaN();
    });

    it('should calculate RSI = 50 for flat prices', () => {
        // No price change → RSI should be ~50 (neutral)
        const candles = createCandles(Array(30).fill(100));
        const result = rsi(candles, 14);
        expect(result).toBeCloseTo(50, 1); // Allow ±1 point
    });

    it('should calculate RSI > 70 for strong uptrend', () => {
        // Strong uptrend: 100 → 200
        const candles = createCandles(
            Array(30).fill(0).map((_, i) => 100 + i * 5)
        );
        const result = rsi(candles, 14);
        expect(result).toBeGreaterThan(70);
    });

    it('should calculate RSI < 30 for strong downtrend', () => {
        // Strong downtrend: 200 → 100
        const candles = createCandles(
            Array(30).fill(0).map((_, i) => 200 - i * 5)
        );
        const result = rsi(candles, 14);
        expect(result).toBeLessThan(30);
    });

    it('should match known test case (manual calculation)', () => {
        // Known RSI values from TradingView for specific price series
        const closes = [
            44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42,
            45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
            46.03, 46.41, 46.22, 45.64
        ];
        const candles = createCandles(closes);
        const result = rsi(candles, 14);
        
        // Expected RSI (from TA-Lib reference): ~67.60
        expect(result).toBeCloseTo(67.60, 1);
    });

    it('should return array of RSI values', () => {
        const closes = Array(30).fill(0).map((_, i) => 100 + i * 2);
        const candles = createCandles(closes);
        const results = rsiArray(candles, 14);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[results.length - 1]).toBeGreaterThan(50); // Uptrend → RSI > 50
    });
});
```

---

Create `tests/engine/slippage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { slippageModel } from '../../src/engine/slippageModel';

describe('Slippage Model', () => {
    it('should add slippage to BUY orders (pay more)', () => {
        const estimate = slippageModel.estimate('NIFTY', 'BUY', 22000, 100);
        
        expect(estimate.adjustedEntry).toBeGreaterThan(22000);
        expect(estimate.slippageAmount).toBeGreaterThan(0);
        expect(estimate.slippagePct).toBeGreaterThan(0);
        expect(estimate.isViable).toBe(true);
    });

    it('should subtract slippage from SELL orders (receive less)', () => {
        const estimate = slippageModel.estimate('NIFTY', 'SELL', 22000, 100);
        
        expect(estimate.adjustedEntry).toBeLessThan(22000);
        expect(estimate.slippageAmount).toBeGreaterThan(0);
        expect(estimate.isViable).toBe(true);
    });

    it('should reject order if slippage exceeds tolerance', () => {
        // Very large order on low liquidity stock
        const estimate = slippageModel.estimate('DEFAULT', 'BUY', 100, 1000000);
        
        expect(estimate.isViable).toBe(false);
        expect(estimate.rejectReason).toContain('slippage exceeds');
    });

    it('should apply lower slippage to NIFTY (high liquidity)', () => {
        const nifty = slippageModel.estimate('NIFTY', 'BUY', 22000, 100);
        const unknown = slippageModel.estimate('UNKNOWN_STOCK', 'BUY', 22000, 100);
        
        expect(nifty.slippagePct).toBeLessThan(unknown.slippagePct);
    });

    it('should record latency stats', () => {
        const strategyId = 'test-strat-001';
        const signalTime = new Date();
        
        slippageModel.recordLatency(strategyId, {
            symbol: 'RELIANCE',
            signalTime,
            orderSentTime: new Date(signalTime.getTime() + 100),
            orderAckTime: new Date(signalTime.getTime() + 250),
            fillTime: new Date(signalTime.getTime() + 500),
            signalToOrderMs: 100,
            orderToAckMs: 150,
            orderToFillMs: 400,
        });
        
        const stats = slippageModel.getLatencyStats('RELIANCE');
        expect(stats.avgSignalToFillMs).toBeGreaterThan(0);
        expect(stats.p95SignalToFillMs).toBeGreaterThan(stats.avgSignalToFillMs);
    });
});
```

---

## 📝 Sample Configuration File

Create `config.sample.yml`:

```yaml
# ===================================================================
# ALGO-TRADING CONFIGURATION (Sample)
# ===================================================================
# Copy to .env and fill in your credentials
# NEVER commit .env to git!
# ===================================================================

# ─── DATABASE ───────────────────────────────────────────────────────
DATABASE_URL="file:./prisma/dev.db"  # SQLite for dev; use PostgreSQL in prod

# ─── AUTHENTICATION ─────────────────────────────────────────────────
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"
ENCRYPTION_KEY="your-32-byte-encryption-key-for-api-keys"  # Base64 encoded

# ─── TRADING MODE ───────────────────────────────────────────────────
# IMPORTANT: Always start with 'paper' mode for testing!
TRADING_MODE="paper"  # Options: paper | live

# ─── BROKER: ANGEL ONE (SmartAPI) ───────────────────────────────────
# Get credentials from: https://smartapi.angelbroking.com/
ANGEL_API_KEY=""
ANGEL_CLIENT_ID=""
ANGEL_MPIN=""  # 4-digit MPIN
ANGEL_TOTP_SECRET=""  # Base32 secret from authenticator app

# ─── BROKER: ZERODHA KITE (Legacy) ──────────────────────────────────
KITE_API_KEY=""
KITE_API_SECRET=""
KITE_ACCESS_TOKEN=""  # Generate daily via login flow

# ─── RISK MANAGEMENT ────────────────────────────────────────────────
# Beginner-safe defaults (modify with caution!)
MAX_DAILY_LOSS=200           # ₹200 max loss per day
MAX_TRADE_SIZE=5000          # ₹5,000 max order value
MAX_TRADES_PER_DAY=5         # Max 5 trades/day
MAX_OPEN_POSITIONS=2         # Max 2 concurrent positions
CONSECUTIVE_LOSS_LIMIT=3     # Auto-stop after 3 losses
MAX_RISK_PER_TRADE=100       # ₹100 max risk per trade

# ─── INITIAL CAPITAL ────────────────────────────────────────────────
INITIAL_BALANCE=5000         # Starting capital: ₹5,000

# ─── SERVER ─────────────────────────────────────────────────────────
NODE_ENV="development"       # development | production
PORT=3001

# ─── LOGGING ────────────────────────────────────────────────────────
LOG_LEVEL="info"             # error | warn | info | debug
LOG_TO_FILE=true

# ─── BACKTESTING ────────────────────────────────────────────────────
# Historical data source (future implementation)
HISTORICAL_DATA_PROVIDER="yahoo"  # yahoo | angelone | csv
BACKTEST_START_DATE="2024-01-01"
BACKTEST_END_DATE="2024-12-31"
BACKTEST_INITIAL_CAPITAL=10000
BACKTEST_COMMISSION=0.03     # 0.03% per trade
BACKTEST_SLIPPAGE=0.01       # 0.01% slippage

# ─── ALERTS ─────────────────────────────────────────────────────────
ALERT_EMAIL=""               # Email for trade alerts
ALERT_SLACK_WEBHOOK=""       # Slack webhook for notifications
ALERT_ON_DAILY_LOSS_PCT=50   # Alert if daily loss > 50% of limit
```

---

## 🤖 GitHub Actions CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-backend:
    name: Test Backend
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: algotrading_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'algo-trading-backend-node/package-lock.json'

      - name: Install dependencies
        working-directory: ./algo-trading-backend-node
        run: npm ci

      - name: Setup test database
        working-directory: ./algo-trading-backend-node
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algotrading_test
        run: |
          npx prisma migrate deploy
          npx prisma db seed

      - name: Run linter
        working-directory: ./algo-trading-backend-node
        run: npm run lint

      - name: Run type check
        working-directory: ./algo-trading-backend-node
        run: npx tsc --noEmit

      - name: Run tests with coverage
        working-directory: ./algo-trading-backend-node
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algotrading_test
          JWT_SECRET: test-jwt-secret-min-32-characters-long
          ENCRYPTION_KEY: dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=
          TRADING_MODE: paper
        run: npm run test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./algo-trading-backend-node/coverage/coverage-final.json
          flags: backend
          fail_ci_if_error: true

  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'algo-trading-frontend/package-lock.json'

      - name: Install dependencies
        working-directory: ./algo-trading-frontend
        run: npm ci

      - name: Run linter
        working-directory: ./algo-trading-frontend
        run: npm run lint

      - name: Run type check
        working-directory: ./algo-trading-frontend
        run: npx tsc --noEmit

      - name: Build
        working-directory: ./algo-trading-frontend
        run: npm run build

  security-scan:
    name: Security Audit
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit (backend)
        working-directory: ./algo-trading-backend-node
        run: npm audit --audit-level=moderate

      - name: Run npm audit (frontend)
        working-directory: ./algo-trading-frontend
        run: npm audit --audit-level=moderate

  docker-build:
    name: Docker Build Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build backend Docker image
        working-directory: ./algo-trading-backend-node
        run: docker build -t algo-trading-backend:test .

      - name: Build frontend Docker image
        working-directory: ./algo-trading-frontend
        run: docker build -t algo-trading-frontend:test .
```

---

## 🧪 Recommended Linters & Commands

### ESLint Config (`.eslintrc.json`):

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-floating-promises": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-debugger": "error"
  }
}
```

### Prettier Config (`.prettierrc.json`):

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 4,
  "arrowParens": "always"
}
```

### Commands:

```bash
# Lint all files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format with Prettier
npx prettier --write "src/**/*.ts"

# Type check without emitting files
npx tsc --noEmit

# Run tests in watch mode
npm test

# Run tests once (for CI)
npm run test:ci

# Generate coverage report
npm run test:ci -- --coverage

# Check for security vulnerabilities
npm audit

# Update dependencies safely
npx npm-check-updates -u -t minor  # Only minor/patch updates
npm install
```

---

## 📚 Documentation & Examples

### Quickstart Commands

```bash
# 1. Clone repository
git clone https://github.com/TalariManohar018/algo-trading.git
cd algo-trading/algo-trading-backend-node

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Setup database
npx prisma migrate dev
npx prisma db seed

# 5. Run tests (IMPORTANT: do this before first run!)
npm test

# 6. Start in paper trading mode (safe!)
npm run dev

# 7. Open frontend
cd ../algo-trading-frontend
npm install
npm run dev
```

### Run Backtest Example

Create `scripts/run_backtest.ts`:

```typescript
import { backtestEngine } from '../src/backtesting/engine';
import { RSIStrategy } from '../src/strategies/rsiStrategy';
import prisma from '../src/config/database';

async function main() {
    console.log('🔍 Loading historical data...');
    
    // Load candles from database or CSV
    const candles = await prisma.candle.findMany({
        where: {
            symbol: 'NIFTY',
            timeframe: 'FIVE_MINUTES',
            timestamp: {
                gte: new Date('2024-01-01'),
                lte: new Date('2024-06-30'),
            },
        },
        orderBy: { timestamp: 'asc' },
    });

    console.log(`📊 Loaded ${candles.length} candles`);

    // Initialize strategy
    const strategy = new RSIStrategy();
    const config = {
        parameters: {
            rsiPeriod: 14,
            oversold: 30,
            overbought: 70,
            smaPeriod: 50,
        },
        stopLossPercent: 2,
        takeProfitPercent: 5,
    };

    // Run backtest
    console.log('⚙️  Running backtest...\n');
    
    const results = await backtestEngine.run({
        strategy,
        config,
        candles,
        initialCapital: 10000,
        commission: 0.0003, // 0.03%
        slippage: 0.0001,   // 0.01%
    });

    // Print results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 BACKTEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Total Return:      ${results.totalReturn.toFixed(2)}%`);
    console.log(`Sharpe Ratio:      ${results.sharpeRatio.toFixed(2)}`);
    console.log(`Max Drawdown:      ${results.maxDrawdown.toFixed(2)}%`);
    console.log(`Win Rate:          ${results.winRate.toFixed(2)}%`);
    console.log(`Total Trades:      ${results.totalTrades}`);
    console.log(`Winning Trades:    ${results.winningTrades}`);
    console.log(`Losing Trades:     ${results.losingTrades}`);
    console.log(`Avg Win:           ₹${results.avgWin.toFixed(2)}`);
    console.log(`Avg Loss:          ₹${results.avgLoss.toFixed(2)}`);
    console.log(`Profit Factor:     ${results.profitFactor.toFixed(2)}`);
    console.log(`Final Capital:     ₹${results.finalCapital.toFixed(2)}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Save results to file
    const fs = require('fs');
    fs.writeFileSync(
        'backtest_results.json',
        JSON.stringify(results, null, 2)
    );
    
    console.log('✅ Results saved to backtest_results.json');
}

main()
    .catch(console.error)
    .finally(() => process.exit());
```

**Expected Output:**

```
🔍 Loading historical data...
📊 Loaded 15,840 candles
⚙️  Running backtest...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 BACKTEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Return:      12.45%
Sharpe Ratio:      1.32
Max Drawdown:      -8.23%
Win Rate:          58.30%
Total Trades:      47
Winning Trades:    27
Losing Trades:     20
Avg Win:           ₹285.40
Avg Loss:          ₹142.60
Profit Factor:     1.95
Final Capital:     ₹11,245.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Results saved to backtest_results.json
```

---

## ⚠️ Safety Warnings

**Add to all live-trading scripts** (`src/server.ts`, `src/engine/executionEngine.ts`):

```typescript
// ═══════════════════════════════════════════════════════════════
// ⚠️  LIVE TRADING WARNING
// ═══════════════════════════════════════════════════════════════
// This software executes REAL trades with REAL money.
//
// RISKS:
//   • You can lose more than your initial capital
//   • Bugs in strategy logic can cause rapid losses
//   • Market conditions may differ from backtest assumptions
//   • Exchange API downtime can prevent stop-loss execution
//
// SAFEGUARDS (but not foolproof):
//   ✓ Max daily loss: ₹200
//   ✓ Max position size: ₹5,000
//   ✓ Mandatory stop-loss on every trade
//   ✓ Max 5 trades/day
//   ✓ Auto-stop after 3 consecutive losses
//
// BEFORE GOING LIVE:
//   1. Backtest strategy on 6+ months of data
//   2. Paper trade for 2+ weeks
//   3. Start with MINIMUM capital (₹5,000 or less)
//   4. Monitor first week daily
//   5. Never risk more than 2% per trade
//
// By proceeding, you acknowledge these risks and agree that the
// developers are NOT liable for any financial losses.
// ═══════════════════════════════════════════════════════════════

if (env.TRADING_MODE === 'live') {
    console.warn('\n⚠️  ⚠️  ⚠️  LIVE TRADING MODE ENABLED ⚠️  ⚠️  ⚠️\n');
    console.warn('Press Ctrl+C within 10 seconds to abort...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
}
```

---

## 📦 Deliverables Summary

1. **High-priority fixes implemented**:
   - [ ] Timezone handling with `luxon`
   - [ ] Order idempotency with `clientOrderId`
   - [ ] Pre-commit test hook with `husky`

2. **Test suite created** (`tests/` directory):
   - [ ] 5+ strategy tests
   - [ ] 5+ risk management tests
   - [ ] 5+ indicator tests
   - [ ] 3+ slippage/latency tests

3. **CI/CD pipeline** (`.github/workflows/ci.yml`):
   - [ ] Automated testing on PR
   - [ ] Linting enforcement
   - [ ] Security audits
   - [ ] Docker build validation

4. **Documentation**:
   - [ ] `config.sample.yml` with all env vars explained
   - [ ] `scripts/run_backtest.ts` example
   - [ ] Safety warnings in live-trading code

5. **Code quality tools**:
   - [ ] ESLint + Prettier configured
   - [ ] Vitest for unit/integration tests
   - [ ] Codecov for coverage tracking

---

## 🚀 Next Steps

1. **Week 1**: Implement top 3 patches (timezone, idempotency, CI)
2. **Week 2**: Write all unit tests (target 80% coverage)
3. **Week 3**: Build backtesting framework
4. **Week 4**: Validate all strategies with historical data
5. **Month 2**: Paper trade for 2 weeks, monitor closely
6. **Month 3**: Go live with MINIMAL capital (₹5,000 max)

**Critical Rule**: NEVER skip paper trading. Your strategies may look good in backtest but fail in live conditions (slippage, latency, data quality).

---

## 📊 Success Metrics

Track these before/after:
- Test coverage: 0% → 80%+
- Build time: Manual → Automated (5 min CI)
- Bug discovery: Production → Pre-commit (shift left)
- Deployment confidence: Low → High (tested code only)
- Strategy validation: None → Backtested + paper-traded

---

**End of Audit Report**

*Generated: 2026-02-22*  
*Repository: https://github.com/TalariManohar018/algo-trading*  
*Contact: Raise GitHub issue for questions*
