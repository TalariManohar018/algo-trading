# Algo Trading Backend

A comprehensive Spring Boot backend for an algorithmic trading platform with strategy management, condition engine, and backtesting capabilities.

## Features

### 🎯 Core Functionality
- **Strategy Management** - Create, activate, deactivate, and manage trading strategies
- **Condition Engine** - Evaluate multiple indicators (EMA, RSI, VWAP, ADX, MACD, etc.)
- **Backtesting** - Simulate strategies against historical data
- **Paper Trading** - Execute simulated trades
- **PnL Tracking** - Calculate and track profit/loss metrics

### 📊 Supported Indicators
- EMA (Exponential Moving Average)
- RSI (Relative Strength Index)
- VWAP (Volume Weighted Average Price)
- ADX (Average Directional Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- Volume
- Price

### 🔧 Technical Stack
- **Spring Boot 3.2.0** - Framework
- **Spring Data JPA** - Data persistence
- **H2 Database** - In-memory database
- **Lombok** - Boilerplate reduction
- **Maven** - Dependency management

## Getting Started

### Prerequisites
- Java 17 or higher
- Maven 3.6+

### Installation

1. Navigate to the project directory:
```bash
cd algo-trading-backend
```

2. Build the project:
```bash
mvn clean install
```

3. Run the application:
```bash
mvn spring-boot:run
```

The server will start on `http://localhost:8080`

### H2 Console
Access the H2 database console at: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:algotrading`
- Username: `sa`
- Password: (leave empty)

## API Endpoints

### Strategy Management

#### Get All Strategies
```http
GET /api/strategies
```

#### Get Strategy by ID
```http
GET /api/strategies/{id}
```

#### Create Strategy
```http
POST /api/strategies
Content-Type: application/json

{
  "name": "EMA Crossover Strategy",
  "instrument": "NIFTY",
  "conditions": [
    {
      "indicator": "EMA",
      "condition": ">",
      "value": "50",
      "logic": "AND"
    },
    {
      "indicator": "RSI",
      "condition": ">",
      "value": "50"
    }
  ]
}
```

#### Activate Strategy
```http
PUT /api/strategies/{id}/activate
```

#### Deactivate Strategy
```http
PUT /api/strategies/{id}/deactivate
```

#### Delete Strategy
```http
DELETE /api/strategies/{id}
```

### Backtesting

#### Run Backtest
```http
POST /api/backtest/{strategyId}
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 100000
}
```

**Response:**
```json
{
  "strategyName": "EMA Crossover Strategy",
  "totalTrades": 127,
  "winningTrades": 87,
  "losingTrades": 40,
  "winRate": 68.5,
  "totalPnl": 45230.50,
  "averageWin": 8234.75,
  "averageLoss": 3567.20,
  "maxDrawdown": 5420.00,
  "sharpeRatio": 1.85,
  "profitFactor": 2.31,
  "trades": [...]
}
```

### Trades

#### Get All Trades
```http
GET /api/trades
```

#### Get Trades by Strategy
```http
GET /api/trades/strategy/{strategyId}
```

#### Get Total PnL
```http
GET /api/trades/pnl/total
```

#### Get PnL by Strategy
```http
GET /api/trades/pnl/by-strategy
```

#### Get Win Rate
```http
GET /api/trades/winrate/{strategyId}
```

## Project Structure

```
src/main/java/com/algo/
├── AlgoTradingApplication.java
├── controller/
│   ├── StrategyController.java
│   ├── BacktestController.java
│   └── TradeController.java
├── service/
│   ├── StrategyService.java
│   ├── ConditionEngineService.java
│   ├── BacktestService.java
│   └── PnlService.java
├── model/
│   ├── Strategy.java
│   ├── Condition.java
│   ├── Trade.java
│   └── BacktestResult.java
├── repository/
│   ├── StrategyRepository.java
│   └── TradeRepository.java
├── dto/
│   ├── StrategyRequest.java
│   ├── ConditionRequest.java
│   ├── TradeResponse.java
│   └── BacktestRequest.java
├── enums/
│   ├── IndicatorType.java
│   ├── ConditionType.java
│   ├── OrderSide.java
│   ├── InstrumentType.java
│   └── StrategyStatus.java
├── config/
│   └── CorsConfig.java
└── util/
    ├── IndicatorCalculator.java
    └── MockDataGenerator.java
```

## How It Works

### 1. Strategy Creation
Create strategies with multiple conditions using various technical indicators.

### 2. Condition Engine
The condition engine evaluates all conditions for a strategy:
- Calculates indicator values
- Compares against threshold values
- Applies logical operators (AND/OR)
- Returns true/false for trade signals

### 3. Backtesting
- Generates mock historical candle data
- Simulates strategy execution
- Tracks entry/exit points
- Calculates comprehensive metrics

### 4. Paper Trading
- Executes simulated trades based on strategy signals
- Stores trades in database
- Calculates PnL for each trade

## Configuration

### Database
The application uses H2 in-memory database by default. Data is reset on restart.

To use a persistent database, modify `application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:h2:file:./data/algotrading
```

### CORS
Configure allowed origins in `CorsConfig.java`:
```java
.allowedOrigins("http://localhost:5173", "http://localhost:5174")
```

## Testing

Run tests:
```bash
mvn test
```

## Development

### Adding New Indicators
1. Add enum to `IndicatorType.java`
2. Implement calculation in `IndicatorCalculator.java`
3. Update condition engine logic if needed

### Adding New Condition Types
1. Add enum to `ConditionType.java`
2. Update evaluation logic in `ConditionEngineService.java`

## Production Considerations

- Replace H2 with production database (PostgreSQL, MySQL)
- Implement authentication and authorization
- Add rate limiting
- Implement real market data integration
- Add comprehensive logging and monitoring
- Implement proper error handling
- Add API documentation (Swagger/OpenAPI)
- Implement WebSocket for real-time updates

## License

This is a demo project for educational purposes.
