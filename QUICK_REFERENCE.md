# QUICK REFERENCE CARD

## 🚀 Start Commands

### Windows
```cmd
start.bat
```

### Linux/Mac  
```bash
chmod +x start.sh
./start.sh
```

---

## 🔗 URLs

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **H2 Console**: http://localhost:8080/h2-console
- **API Docs**: http://localhost:8080/swagger-ui.html (if enabled)

---

## 🔐 Test Credentials

- **Email**: trader@algo.com
- **Password**: password123

---

## 📊 Pre-Seeded Data

### Strategies (2)
1. **NIFTY Breakout** - Buy when price > 22,100
2. **BANKNIFTY Range** - Buy when price < 45,500

### Candle Data
- NIFTY: 500 historical candles
- BANKNIFTY: 500 historical candles
- FINNIFTY: 300 historical candles

### Wallet
- Initial Balance: ₹1,00,000

---

## 🎮 Dashboard Quick Actions

### Engine Control
- **START** - Begin trading
- **STOP** - Stop trading gracefully
- **🚨 EMERGENCY STOP** - Square off all positions

### Strategy Management
- View all strategies
- Activate/Deactivate
- Create new strategy

### Monitoring
- Real-time P&L
- Open positions
- Order book
- Activity feed

---

## ⚡ Keyboard Shortcuts (Future Enhancement)

- `Ctrl + E` - Toggle engine
- `Ctrl + K` - Emergency stop
- `Ctrl + S` - Open strategies
- `Ctrl + P` - Open positions

---

## 🔧 Configuration Tweaks

### Change Initial Capital
File: `WalletService.java`
```java
.balance(100000.0)  // Change this value
```

### Change Risk Limits
File: `RiskManagementService.java`
```java
private static final double MAX_LOSS_PER_DAY = 5000.0;
private static final int MAX_TRADES_PER_DAY = 10;
private static final double MAX_CAPITAL_PER_TRADE = 10000.0;
```

### Change Market Hours
File: `RiskManagementService.java`
```java
private static final LocalTime MARKET_OPEN = LocalTime.of(9, 15);
private static final LocalTime MARKET_CLOSE = LocalTime.of(15, 30);
```

### Change Candle Generation Frequency
File: `MarketDataSimulator.java`
```java
@Scheduled(cron = "0 * * * * *")  // Every minute at 0 seconds
// Change to: "0 */5 * * * *" for 5 minutes
```

---

## 📋 Common Tasks

### View Database
1. Open http://localhost:8080/h2-console
2. JDBC URL: `jdbc:h2:mem:algotrading`
3. Username: `sa`
4. Password: (leave empty)

### Check Engine Status
```bash
curl http://localhost:8080/api/engine/status
```

### View All Strategies
```bash
curl http://localhost:8080/api/strategies
```

### Emergency Stop
```bash
curl -X POST http://localhost:8080/api/engine/emergency-stop?userId=1
```

---

## 🐛 Common Issues

### Backend won't start
```bash
cd algo-trading-backend
mvnw clean install
mvnw spring-boot:run
```

### Frontend connection refused
- Check backend is running on port 8080
- Check `API_BASE_URL` in `src/api/config.ts`

### Candles not generating
- Check engine status
- Verify `@EnableScheduling` in main application class
- Check logs for errors

### Orders not executing
- Check wallet balance
- Verify risk limits not breached
- Check market hours (9:15 AM - 3:30 PM IST)

---

## 📊 Risk Limits (Defaults)

| Limit | Value |
|-------|-------|
| Max Loss Per Day | ₹5,000 |
| Max Trades Per Day | 10 |
| Max Capital Per Trade | ₹10,000 |
| Initial Capital | ₹1,00,000 |
| Margin Requirement | 20% |

---

## 🔔 SSE Events

Subscribe to real-time updates:
```javascript
const eventSource = new EventSource('http://localhost:8080/api/sse/subscribe?userId=1');

eventSource.addEventListener('engine_status', (e) => {
    console.log('Engine status:', JSON.parse(e.data));
});

eventSource.addEventListener('order_update', (e) => {
    console.log('Order update:', JSON.parse(e.data));
});
```

---

## 🧪 Test Commands

### Run All Tests
```bash
cd algo-trading-backend
mvnw test
```

### Run Specific Test
```bash
mvnw test -Dtest=TradingEngineIntegrationTest
```

### Run with Coverage
```bash
mvnw clean test jacoco:report
```

---

## 📁 Important Files

### Backend
- `TradingEngineService.java` - Core trading logic
- `RiskManagementService.java` - Risk enforcement
- `MockBrokerService.java` - Paper trading
- `application.yml` - Configuration
- `DataSeeder.java` - Test data

### Frontend
- `Dashboard.tsx` - Main trading screen
- `StrategyBuilder.tsx` - Strategy creator
- `EngineControlPanel.tsx` - Engine controls
- `config.ts` - API configuration

---

## 🎯 Testing Workflow

1. **Start System**
   ```
   start.bat (or start.sh)
   ```

2. **Login**
   - Email: trader@algo.com
   - Password: password123

3. **Review Pre-Seeded Strategies**
   - Navigate to Strategies page
   - Check 2 pre-created strategies

4. **Activate a Strategy**
   - Click "Activate" on NIFTY Breakout

5. **Start Engine**
   - Go to Dashboard
   - Click "START ENGINE"

6. **Monitor**
   - Watch Activity Feed
   - Monitor candle generation (every minute)
   - Wait for signals

7. **Test Emergency Stop**
   - Click "🚨 EMERGENCY STOP"
   - Verify all positions squared off

8. **Check Audit Logs**
   - Settings → Audit Logs
   - Review all events

---

## 🚦 Status Indicators

### Engine Status
- 🟢 **RUNNING** - Active trading
- 🟡 **STOPPED** - Idle
- 🔴 **LOCKED** - Risk breach, manual reset needed
- 🟠 **PAUSED** - Temporarily suspended

### Order Status
- ⚪ **CREATED** - Order object created
- 🔵 **PLACED** - Sent to broker
- 🟢 **FILLED** - Execution complete
- 🔴 **REJECTED** - Broker rejected
- ⚫ **CLOSED** - Position closed

### Position Status
- 🟢 **OPEN** - Active position
- ⚫ **CLOSED** - Position exited

---

## 📞 Emergency Contacts

### System Issues
- Check logs: `algo-trading-backend/logs/`
- H2 console: http://localhost:8080/h2-console
- Browser DevTools → Console/Network

### Code Issues
- Backend errors: Check stack traces in terminal
- Frontend errors: Check browser console
- Database issues: Check H2 console

---

## ⚠️ Safety Checklist

Before live trading:
- [ ] Test for 2+ weeks in paper mode
- [ ] Verify all strategies work as expected
- [ ] Test emergency stop works
- [ ] Verify risk limits enforced
- [ ] Check wallet reconciliation
- [ ] Test with smallest position size first
- [ ] Set up monitoring/alerts
- [ ] Document rollback procedure
- [ ] Start with max ₹10,000 capital

---

## 🎨 Customization

### Change UI Theme
File: `tailwind.config.js`
```javascript
theme: {
  extend: {
    colors: {
      primary: '#3B82F6',  // Change this
    }
  }
}
```

### Change Port
**Backend** (`application.yml`):
```yaml
server:
  port: 8080  # Change this
```

**Frontend** (`vite.config.ts`):
```typescript
server: {
  port: 5173  # Change this
}
```

---

## 📈 Performance Tips

1. **Backend**
   - Increase JVM heap: `-Xmx2048m`
   - Enable JIT compiler
   - Use connection pooling

2. **Frontend**
   - Enable production build: `npm run build`
   - Use code splitting
   - Optimize re-renders

3. **Database**
   - Add indexes on frequently queried fields
   - Use query pagination
   - Archive old audit logs

---

## 🔄 Update Workflow

1. Pull latest code
2. Run `mvnw clean install`
3. Run `npm install`
4. Restart services

---

**Last Updated**: February 16, 2026  
**System Version**: 1.0.0  
**Status**: Production Ready (Paper Trading)
