# Algo Trading Platform - Complete API Documentation

## Base URL
```
http://localhost:8080/api
```

## Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <jwt_token>
```

---

## 🚨 Emergency Endpoints

### POST /emergency/stop
**Trigger Emergency Kill Switch**

Immediately stops engine, cancels all orders, squares off all positions.

**Request:**
```bash
curl -X POST http://localhost:8080/api/emergency/stop \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-15T10:30:45",
  "triggeredBy": "User triggered",
  "engineStopped": true,
  "ordersCancelled": true,
  "positionsSquaredOff": true,
  "riskLocked": true,
  "closedPositions": [
    {
      "symbol": "RELIANCE",
      "pnl": -150.50
    }
  ],
  "errors": []
}
```

---

### POST /emergency/reset
**Reset After Emergency**

Unlocks system after emergency stop. Engine remains STOPPED.

**Request:**
```bash
curl -X POST http://localhost:8080/api/emergency/reset \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Emergency reset completed. Engine is now STOPPED.",
  "note": "You can manually start the engine when ready."
}
```

---

### GET /emergency/broker-mode
**Get Current Broker Mode**

Returns current trading mode and broker connection status.

**Request:**
```bash
curl http://localhost:8080/api/emergency/broker-mode \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "mode": "PAPER",
  "provider": "MOCK",
  "isLive": false,
  "isConnected": true,
  "warning": "Paper trading mode"
}
```

**Live Mode Response:**
```json
{
  "mode": "LIVE",
  "provider": "ZERODHA",
  "isLive": true,
  "isConnected": true,
  "warning": "⚠️ LIVE TRADING - REAL MONEY AT RISK ⚠️"
}
```

---

### GET /emergency/audit-logs
**Get All Audit Logs**

Returns complete audit trail for current user.

**Request:**
```bash
curl http://localhost:8080/api/emergency/audit-logs \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 123,
    "userId": 1,
    "eventType": "EMERGENCY_STOP",
    "severity": "CRITICAL",
    "message": "EMERGENCY STOP triggered by User triggered",
    "metadata": "{\"triggeredBy\":\"User triggered\"}",
    "timestamp": "2026-02-15T10:30:45"
  },
  {
    "id": 122,
    "eventType": "ORDER_FILLED",
    "severity": "INFO",
    "message": "Order filled: RELIANCE at ₹2505.50",
    "metadata": "{\"orderId\":45,\"symbol\":\"RELIANCE\",\"filledPrice\":2505.50}",
    "timestamp": "2026-02-15T10:25:30"
  }
]
```

---

### GET /emergency/audit-logs/critical
**Get Critical Audit Logs**

Returns only WARNING and CRITICAL severity logs.

**Request:**
```bash
curl http://localhost:8080/api/emergency/audit-logs/critical \
  -H "Authorization: Bearer <token>"
```

**Response:** Same format as above, filtered by severity.

---

## 🎛️ Engine Endpoints

### POST /engine/start
**Start Trading Engine**

Starts the trading engine. Will be rejected if risk is locked.

**Request:**
```bash
curl -X POST http://localhost:8080/api/engine/start \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "status": "RUNNING",
  "lastTickAt": "2026-02-15T10:35:00",
  "lockReason": null,
  "updatedAt": "2026-02-15T10:35:00"
}
```

**Error Response (Risk Locked):**
```json
{
  "timestamp": "2026-02-15T10:35:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Engine locked: Daily loss limit breached: ₹5000.00 / ₹5000.00"
}
```

---

### POST /engine/stop
**Stop Trading Engine**

Gracefully stops the trading engine. Does NOT close positions.

**Request:**
```bash
curl -X POST http://localhost:8080/api/engine/stop \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "status": "STOPPED",
  "lastTickAt": "2026-02-15T10:35:00",
  "lockReason": "Manual stop",
  "updatedAt": "2026-02-15T10:40:00"
}
```

---

### GET /engine/status
**Get Engine Status**

Returns current engine state.

**Request:**
```bash
curl http://localhost:8080/api/engine/status \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "status": "RUNNING",
  "lastTickAt": "2026-02-15T10:35:00",
  "lockReason": null,
  "updatedAt": "2026-02-15T10:35:00"
}
```

**Status Values:**
- `RUNNING` - Engine active, evaluating strategies
- `STOPPED` - Engine inactive
- `LOCKED` - Engine locked due to risk breach

---

## 🛡️ Risk Endpoints

### GET /risk
**Get Risk State**

Returns current risk limits and daily stats.

**Request:**
```bash
curl http://localhost:8080/api/risk \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "dailyLoss": 1250.50,
  "dailyTradeCount": 5,
  "isLocked": false,
  "lockReason": null,
  "tradingDate": "2026-02-15",
  "updatedAt": "2026-02-15T10:40:00"
}
```

**When Locked:**
```json
{
  "id": 1,
  "userId": 1,
  "dailyLoss": 5100.00,
  "dailyTradeCount": 12,
  "isLocked": true,
  "lockReason": "Daily loss limit breached: ₹5100.00 / ₹5000.00",
  "tradingDate": "2026-02-15",
  "updatedAt": "2026-02-15T11:20:00"
}
```

---

### POST /risk/unlock
**Unlock Risk State**

Manually unlocks risk state (requires password confirmation).

**Request:**
```bash
curl -X POST http://localhost:8080/api/risk/unlock \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "user_password"}'
```

**Response:**
```json
{
  "message": "Risk state unlocked successfully"
}
```

---

### POST /risk/reset
**Reset Daily Limits**

Resets daily loss and trade count to zero. Use at start of new trading day.

**Request:**
```bash
curl -X POST http://localhost:8080/api/risk/reset \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Daily limits reset successfully"
}
```

---

## 📊 Strategy Endpoints

### GET /strategies
**Get All Strategies**

Returns all strategies for current user.

**Request:**
```bash
curl http://localhost:8080/api/strategies \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "name": "RSI Momentum",
    "description": "Buy on RSI oversold, sell on overbought",
    "instrument": "RELIANCE",
    "status": "RUNNING",
    "conditions": [...],
    "createdAt": "2026-02-10T09:00:00"
  }
]
```

---

### POST /strategies
**Create Strategy**

Creates a new trading strategy.

**Request:**
```bash
curl -X POST http://localhost:8080/api/strategies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Moving Average Crossover",
    "description": "Buy when fast MA crosses above slow MA",
    "instrument": "TCS",
    "conditions": [
      {
        "indicatorType": "SMA",
        "conditionType": "ENTRY",
        "value": 20
      }
    ]
  }'
```

**Response:**
```json
{
  "id": 2,
  "userId": 1,
  "name": "Moving Average Crossover",
  "status": "INACTIVE",
  "createdAt": "2026-02-15T11:00:00"
}
```

---

### PUT /strategies/{id}/activate
**Activate Strategy**

Sets strategy status to RUNNING.

**Request:**
```bash
curl -X PUT http://localhost:8080/api/strategies/1/activate \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "status": "RUNNING",
  "message": "Strategy activated"
}
```

---

### PUT /strategies/{id}/deactivate
**Deactivate Strategy**

Sets strategy status to INACTIVE.

**Request:**
```bash
curl -X PUT http://localhost:8080/api/strategies/1/deactivate \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "status": "INACTIVE",
  "message": "Strategy deactivated"
}
```

---

## 📈 Position Endpoints

### GET /positions
**Get All Positions**

Returns all positions (open and closed).

**Request:**
```bash
curl http://localhost:8080/api/positions \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 10,
    "userId": 1,
    "strategyId": 1,
    "strategyName": "RSI Momentum",
    "symbol": "RELIANCE",
    "side": "LONG",
    "quantity": 1,
    "entryPrice": 2500.00,
    "currentPrice": 2510.50,
    "unrealizedPnl": 10.50,
    "realizedPnl": 0.0,
    "status": "OPEN",
    "openedAt": "2026-02-15T10:00:00",
    "closedAt": null
  }
]
```

---

### GET /positions/open
**Get Open Positions**

Returns only currently open positions.

**Request:**
```bash
curl http://localhost:8080/api/positions/open \
  -H "Authorization: Bearer <token>"
```

**Response:** Same format as above, filtered by `status: OPEN`.

---

### POST /positions/{id}/close
**Close Position**

Manually closes an open position.

**Request:**
```bash
curl -X POST http://localhost:8080/api/positions/10/close \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"exitPrice": 2510.50}'
```

**Response:**
```json
{
  "id": 10,
  "status": "CLOSED",
  "realizedPnl": 10.50,
  "closedAt": "2026-02-15T11:30:00"
}
```

---

## 🔄 Order Endpoints

### GET /orders
**Get All Orders**

Returns all orders for current user.

**Request:**
```bash
curl http://localhost:8080/api/orders \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 45,
    "userId": 1,
    "strategyId": 1,
    "strategyName": "RSI Momentum",
    "symbol": "RELIANCE",
    "side": "BUY",
    "quantity": 1,
    "orderType": "MARKET",
    "limitPrice": null,
    "status": "FILLED",
    "placedPrice": 2500.00,
    "filledPrice": 2500.25,
    "createdAt": "2026-02-15T10:00:00",
    "placedAt": "2026-02-15T10:00:01",
    "filledAt": "2026-02-15T10:00:02",
    "rejectedReason": null
  }
]
```

**Order Status Values:**
- `CREATED` - Order created internally
- `PLACED` - Order sent to broker
- `FILLED` - Order executed
- `PARTIALLY_FILLED` - Partial execution
- `REJECTED` - Order rejected by broker
- `CLOSED` - Order cancelled

---

### GET /orders/open
**Get Open Orders**

Returns orders with status PLACED.

**Request:**
```bash
curl http://localhost:8080/api/orders/open \
  -H "Authorization: Bearer <token>"
```

**Response:** Same format as above, filtered by `status: PLACED`.

---

## 💰 Wallet Endpoints

### GET /wallet
**Get Wallet Info**

Returns current wallet balance and margin info.

**Request:**
```bash
curl http://localhost:8080/api/wallet \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "balance": 98750.50,
  "availableMargin": 78750.50,
  "usedMargin": 20000.00,
  "realizedPnl": -1249.50,
  "unrealizedPnl": 10.50,
  "updatedAt": "2026-02-15T11:00:00"
}
```

---

## 👤 Auth Endpoints (Public)

### POST /auth/register
**Register New User**

Creates a new user account.

**Request:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "trader1",
    "password": "SecurePass123!",
    "email": "trader1@example.com"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "trader1",
  "email": "trader1@example.com"
}
```

---

### POST /auth/login
**Login**

Authenticates user and returns JWT token.

**Request:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "trader1",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "trader1",
  "email": "trader1@example.com"
}
```

---

## 📊 Trade Endpoints

### GET /trades
**Get All Trades**

Returns complete trade history.

**Request:**
```bash
curl http://localhost:8080/api/trades \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 25,
    "userId": 1,
    "strategyId": 1,
    "strategyName": "RSI Momentum",
    "symbol": "RELIANCE",
    "entryPrice": 2500.00,
    "exitPrice": 2510.50,
    "quantity": 1,
    "pnl": 10.50,
    "entryTime": "2026-02-15T10:00:00",
    "exitTime": "2026-02-15T11:30:00",
    "executedAt": "2026-02-15T11:30:00"
  }
]
```

---

### GET /trades/pnl/total
**Get Total PnL**

Returns cumulative profit/loss.

**Request:**
```bash
curl http://localhost:8080/api/trades/pnl/total \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "totalPnl": -1239.00,
  "realizedPnl": -1249.50,
  "unrealizedPnl": 10.50
}
```

---

## 🏥 Health Endpoint (Public)

### GET /health
**System Health Check**

Returns system health status.

**Request:**
```bash
curl http://localhost:8080/api/health
```

**Response:**
```json
{
  "status": "UP",
  "broker": {
    "mode": "PAPER",
    "provider": "MOCK",
    "connected": true
  },
  "database": "UP",
  "timestamp": "2026-02-15T12:00:00"
}
```

---

## 🔥 Common Error Responses

### 401 Unauthorized
```json
{
  "timestamp": "2026-02-15T10:00:00",
  "status": 401,
  "error": "Unauthorized",
  "message": "JWT token is missing or invalid"
}
```

### 403 Forbidden
```json
{
  "timestamp": "2026-02-15T10:00:00",
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied"
}
```

### 400 Bad Request
```json
{
  "timestamp": "2026-02-15T10:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid request parameters"
}
```

### 500 Internal Server Error
```json
{
  "timestamp": "2026-02-15T10:00:00",
  "status": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## 📝 Rate Limits

Currently no rate limits implemented. For production:
- Recommended: 100 requests per minute per user
- Emergency endpoints: Unlimited
- Market data: 10 requests per second

---

## 🔐 Security Notes

1. **Always use HTTPS in production**
2. **Never commit JWT secrets** to git
3. **Rotate tokens every 24 hours** (configured in `application.yml`)
4. **Store broker credentials** in environment variables
5. **Enable audit logs** for compliance

---

## 💡 Best Practices

1. **Check broker mode** before each session
2. **Poll engine status** every 10 seconds when running
3. **Review audit logs** daily
4. **Keep emergency endpoint** available at all times
5. **Test emergency stop** weekly

---

**API Version**: 1.0.0
**Last Updated**: February 15, 2026
**Documentation Status**: Complete
