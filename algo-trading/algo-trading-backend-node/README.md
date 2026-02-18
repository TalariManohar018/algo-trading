# Algo Trading Backend — Node.js + TypeScript + Prisma

Production-ready algorithmic trading backend with **real** indicator calculations,
order execution, risk management, and backtesting.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database URL and secrets

# 3. Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Start in development mode
npm run dev
```

## Architecture

```
src/
├── config/          # Environment & database config
├── middleware/       # Auth (JWT), error handler, rate limiter
├── routes/          # Express route handlers
├── services/        # Business logic
│   ├── authService        # Registration, login, JWT
│   ├── riskService        # Pre-order risk checks, daily limits
│   ├── backtestService    # Walk-forward simulation engine
│   ├── marketDataService  # WebSocket ticks + candle aggregation
│   ├── paperBroker        # Simulated order fills
│   └── zerodhaBroker      # Live Zerodha Kite Connect v3
├── strategies/      # Indicator calculations + strategy logic
│   ├── indicators         # SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP
│   ├── movingAverageCrossover
│   └── rsiStrategy
├── engine/          # Order executor (validate → place → fill → close)
├── utils/           # Logger, encryption, custom errors
├── app.ts           # Express app setup
└── server.ts        # Entry point
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT token |
| GET | `/api/auth/me` | Yes | Current user profile |
| GET | `/api/strategies/available` | Yes | List strategy types |
| POST | `/api/strategies` | Yes | Create strategy |
| GET | `/api/strategies` | Yes | List user strategies |
| PATCH | `/api/strategies/:id/start` | Yes | Start strategy |
| PATCH | `/api/strategies/:id/stop` | Yes | Stop strategy |
| POST | `/api/orders` | Yes | Place order (risk-checked) |
| GET | `/api/orders` | Yes | List orders |
| DELETE | `/api/orders/:id` | Yes | Cancel order |
| GET | `/api/positions` | Yes | List positions |
| GET | `/api/trades` | Yes | List trade history |
| GET | `/api/trades/summary` | Yes | Trade statistics |
| POST | `/api/backtests` | Yes | Run backtest |
| GET | `/api/backtests` | Yes | Backtest history |
| GET | `/api/wallet` | Yes | Wallet balance |
| GET | `/api/risk` | Yes | Risk state |
| POST | `/api/risk/unlock` | Yes | Unlock engine |
| GET | `/api/dashboard` | Yes | Full dashboard data |
| GET | `/api/dashboard/equity-curve` | Yes | Equity curve |
| GET | `/health` | No | Health check |

## Trading Modes

- **Paper Mode** (default): Simulated prices, no real money
- **Live Mode**: Connects to Zerodha Kite Connect v3 — requires API key

## Risk Management

Pre-order checks enforced on every trade:
- Daily loss limit (default ₹5,000)
- Max trade size (default ₹50,000)
- Max open positions (default 5)
- Market hours enforcement (IST 9:15-15:30, Mon-Fri)
- Automatic engine lock on breach

## Deployment

### Render (recommended)
Push and connect repo — `render.yaml` configures everything.

### Docker
```bash
docker build -t algo-trading-backend .
docker run -p 3000:3000 --env-file .env algo-trading-backend
```

### Railway
Connect GitHub repo, set environment variables, deploy.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | TypeScript compilation |
| `npm start` | Production server |
| `npm test` | Run tests |
| `npx prisma studio` | Database GUI |
