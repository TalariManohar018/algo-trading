# Quick Test Guide

## Prerequisites
Both servers must be running:
- Backend: http://localhost:8080
- Frontend: http://localhost:5173

## Test Flow

### 1. Start Servers

**Terminal 1 - Backend:**
```powershell
cd algo-trading-backend
.\mvnw.cmd spring-boot:run
```

**Terminal 2 - Frontend:**
```powershell
cd algo-trading-frontend
npm run dev
```

### 2. Register & Login

1. Open http://localhost:5173
2. Click "Sign Up"
3. Enter:
   - Name: TestUser
   - Email: test@example.com
   - Password: test123
4. Click "Create Account"
5. You'll be redirected to Dashboard

### 3. Create a Strategy

1. Navigate to "Strategies" page
2. Click "Create Strategy"
3. Fill in:
   - Name: Test Strategy
   - Symbol: NIFTY
   - Instrument: OPTION
   - Add Entry Condition: RSI < 30
   - Add Exit Condition: Profit Target > 50
4. Click "Save Strategy"

### 4. Start Trading Engine

1. Go to Dashboard
2. Click "START ENGINE" button
3. Engine status should change to "RUNNING"
4. Watch the activity feed for events

### 5. Activate Strategy

1. In Dashboard, find your strategy in "Running Strategies" section
2. Click "Activate"
3. Strategy will start evaluating on each 1-minute tick

### 6. Monitor Trading

**Dashboard shows:**
- Engine Status: RUNNING
- Running Strategies: 1 active
- Open Positions: (will appear when entry signal triggers)
- Active Orders: (will appear when orders are placed)
- Wallet: ₹100,000 balance
- Risk State: Daily loss and trade count

### 7. Test Order Flow

The backend trading engine will:
1. Evaluate strategy every 60 seconds
2. Check entry conditions (RSI < 30)
3. Place BUY order if condition met
4. Order goes: CREATED → PLACED → FILLED
5. Position opened automatically
6. Track unrealized PnL
7. Check exit conditions
8. Close position on exit signal

### 8. Test Risk Limits

**Max Daily Loss:**
1. Manually close positions with loss
2. When total loss > ₹5,000, engine auto-locks
3. All positions squared off
4. Trading stopped for the day

**Max Daily Trades:**
1. Execute 10 trades (open and close)
2. Engine auto-locks on 11th trade attempt
3. Risk panel shows lock reason

### 9. Emergency Stop

1. Click "EMERGENCY STOP" button
2. Engine stops immediately
3. All open positions squared off
4. Engine locked until manual restart

### 10. View Reports

**Trades Page:**
- View all executed trades
- Filter by strategy
- See profit/loss per trade
- Win rate statistics

**Positions Page:**
- View open positions
- Unrealized PnL
- Entry/exit prices
- Duration

**Settings Page:**
- Configure risk limits
- Set trading hours
- Adjust notification preferences

---

## API Testing (Postman/Thunder Client)

### Register User
```http
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "test123",
  "email": "test@example.com"
}
```

### Login
```http
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "test123"
}
```

Response includes JWT token.

### Get Strategies (with JWT)
```http
GET http://localhost:8080/api/strategies
Authorization: Bearer YOUR_JWT_TOKEN
```

### Start Engine
```http
POST http://localhost:8080/api/engine/start
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Engine Status
```http
GET http://localhost:8080/api/engine/status
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Wallet
```http
GET http://localhost:8080/api/wallet
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Troubleshooting

### Backend not starting
- Check if port 8080 is available
- Kill existing Java processes: 
  ```powershell
  Get-NetTCPConnection -LocalPort 8080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```

### Frontend not connecting to backend
- Verify CORS is enabled
- Check JWT token in localStorage
- Clear browser cache and cookies

### Orders not being created
- Check if engine is RUNNING
- Verify strategy is ACTIVE
- Ensure market price conditions are met
- Check console logs for errors

### Risk lock triggered unexpectedly
- Check risk settings in database
- Verify daily loss calculation
- Reset risk state if needed:
  ```http
  POST http://localhost:8080/api/risk/reset
  ```

---

## Database Access

H2 Console: http://localhost:8080/h2-console

**Connection Settings:**
- JDBC URL: `jdbc:h2:mem:algotrading`
- Username: `sa`
- Password: (leave blank)

**Useful Queries:**
```sql
-- View all strategies
SELECT * FROM strategies;

-- View all orders
SELECT * FROM orders;

-- View all positions
SELECT * FROM positions;

-- View wallet
SELECT * FROM wallets;

-- View risk state
SELECT * FROM risk_state;

-- View engine state
SELECT * FROM engine_state;
```

---

## Success Criteria

✅ User can register and login
✅ JWT token stored and sent with requests
✅ Strategies can be created and activated
✅ Trading engine starts/stops via dashboard
✅ Engine evaluates strategies every 60 seconds
✅ Orders are created and filled automatically
✅ Positions track unrealized PnL
✅ Wallet balance updates correctly
✅ Risk limits are enforced strictly
✅ Emergency stop works immediately
✅ Dashboard shows real-time data

---

## Next: Live Trading Setup

1. Obtain broker API credentials (Zerodha/Angel)
2. Update `ZerodhaBrokerService` or `AngelBrokerService`
3. Change `@Primary` from `MockBrokerService` to live broker
4. Test in broker sandbox first
5. Deploy to production with PostgreSQL
6. Set up monitoring and alerts
