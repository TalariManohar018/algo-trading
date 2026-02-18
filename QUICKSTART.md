# Algo Trading Platform - Quick Start Guide

## System Status ✅

### Backend (Spring Boot)
- **URL**: http://localhost:8080
- **Health Check**: http://localhost:8080/api/health
- **Status**: RUNNING ✅

### Frontend (React + Vite)
- **URL**: http://localhost:5173
- **Status**: RUNNING ✅

---

## Starting the System

### 1. Start Backend
```bash
cd algo-trading-backend
.\mvnw.cmd spring-boot:run
```

Wait for:
```
Started AlgoTradingApplication in X seconds
```

Verify: http://localhost:8080/api/health

### 2. Start Frontend
```bash
cd algo-trading-frontend
npm run dev
```

Verify: http://localhost:5173

---

## Testing the System

### Test Backend Health
```bash
curl http://localhost:8080/api/health
```

Expected Response:
```json
{
  "service": "Algo Trading Backend",
  "version": "1.0.0",
  "status": "UP",
  "timestamp": "2026-02-15T19:20:56.919340Z"
}
```

### Test Authentication
```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Trading Engine
```bash
# Get engine status (requires JWT token)
curl http://localhost:8080/api/engine/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Start engine
curl -X POST http://localhost:8080/api/engine/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Stop engine
curl -X POST http://localhost:8080/api/engine/stop \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Using the Frontend

1. **Open Browser**: Navigate to http://localhost:5173

2. **Sign Up/Login**: Create an account or login

3. **Create Strategy**: 
   - Go to `/builder`
   - Build your strategy with conditions
   - Save and activate

4. **Start Trading Engine**:
   - Go to `/dashboard`
   - Click "Start Engine"
   - Monitor trades, positions, and PnL in real-time

5. **Monitor Activity**:
   - Dashboard shows live engine status
   - OrderBook displays active orders
   - Positions page tracks open positions
   - Trades page shows execution history

---

## Available Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token

### Strategies
- `GET /api/strategies` - All strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/{id}/activate` - Start strategy
- `PUT /api/strategies/{id}/deactivate` - Stop strategy

### Trading Engine
- `POST /api/engine/start` - Start engine
- `POST /api/engine/stop` - Stop engine
- `POST /api/engine/emergency-stop` - Emergency stop + square off
- `GET /api/engine/status` - Engine state

### Orders
- `GET /api/orders` - All orders
- `POST /api/orders` - Create order

### Positions
- `GET /api/positions` - All positions
- `GET /api/positions/open` - Open positions only

### Trades
- `GET /api/trades` - Trade history

### Wallet
- `GET /api/wallet` - Balance & margin info

---

## Current Configuration

### Backend (application.yml)
```yaml
server:
  port: 8080

trading:
  engine:
    tick-interval: 60000  # 1 minute
    max-trades-per-day: 10
  broker:
    mode: MOCK  # Using MockBrokerService
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8080
```

---

## System Architecture

```
Frontend (React)              Backend (Spring Boot)
localhost:5173                localhost:8080
      │                              │
      │  HTTP/REST APIs              │
      ├──────────────────────────────┤
      │  JWT Authentication          │
      │  Strategy CRUD                │
      │  Engine Control               │
      │  Orders/Positions/Trades      │
      └──────────────────────────────┘
                     │
                     ▼
              MockBrokerService
              (Paper Trading)
```

---

## Features Implemented

### ✅ Trading Engine
- 1-minute tick scheduler
- Strategy evaluation
- Order execution
- Position management
- Risk enforcement
- Auto square-off on breach

### ✅ Order Lifecycle
- CREATED → PLACED → FILLED → CLOSED
- Slippage simulation (0-0.2%)
- Rejection simulation (5%)
- Realistic latency

### ✅ Risk Management
- Daily loss limit
- Daily trade count limit
- Capital per trade limit
- Hard enforcement
- Engine auto-lock

### ✅ Paper Trading
- MockBrokerService active
- 10+ stock symbols
- Realistic price movements
- Margin calculation
- PnL tracking

### ✅ Security
- JWT authentication
- BCrypt password hashing
- Protected endpoints
- CORS configured

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8080
$port = 8080
Get-NetTCPConnection -LocalPort $port | ForEach-Object { 
    Stop-Process -Id $_.OwningProcess -Force 
}
```

### Backend Not Starting
```bash
# Check Java version
java -version  # Should be 17+

# Clean build
cd algo-trading-backend
.\mvnw.cmd clean package -DskipTests
```

### Frontend Build Errors
```bash
# Clean install
cd algo-trading-frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### CORS Errors
- Ensure backend CorsConfig allows localhost:5173
- Check browser console for specific CORS error
- Verify API_BASE_URL in frontend config.ts

---

## Next Steps

### For Development
- Add more strategies in builder
- Test with different indicators
- Monitor risk enforcement
- Track position PnL

### For Production
1. Switch to PostgreSQL database
2. Configure production broker (Zerodha/Angel)
3. Set up proper logging & monitoring
4. Deploy to production server
5. Configure SSL/HTTPS
6. Set up CI/CD pipeline

---

## Support

- Backend Logs: Check terminal running `spring-boot:run`
- Frontend Logs: Check browser console (F12)
- Database: H2 Console at http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:algotrading`
  - Username: `sa`
  - Password: (empty)

---

**System Status**: ✅ FULLY OPERATIONAL

**Ready for**: Paper Trading | Strategy Development | Testing

**Not Ready for**: Live Trading (requires broker integration)
