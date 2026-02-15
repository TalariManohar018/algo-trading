# AlgoTrader Pro - Algorithmic Trading Platform

A modern, responsive frontend for an algorithmic trading platform built with React, TypeScript, and Tailwind CSS.

## Features

### 📊 Dashboard
- Real-time PnL tracking
- Active strategies overview
- Win/loss ratio metrics
- Equity curve visualization
- Performance metrics (Sharpe Ratio, Max Drawdown, Profit Factor)
- Recent activity feed

### 📈 Strategies Page
- Grid view of all trading strategies
- Filter by status (Running/Stopped)
- Filter by instrument (NIFTY/BANKNIFTY)
- Search strategies by name
- Start/Stop strategy controls
- Individual strategy metrics

### 🛠️ Strategy Builder
- Visual rule-based strategy builder
- Multiple indicator support (EMA, RSI, VWAP, ADX, MACD, Bollinger Bands)
- Condition types (>, <, >=, <=, =, Crosses Above, Crosses Below)
- Logical operators (AND/OR)
- Add/remove conditions dynamically
- Strategy templates
- Risk management settings

### 📉 Backtest Page
- Select strategies for backtesting
- Date range configuration
- Comprehensive backtest results:
  - Total return, Sharpe Ratio, Max Drawdown, Win Rate
  - Monthly returns chart
  - Detailed trade history table
  - Statistics (Total trades, Win/Loss breakdown, Average win/loss)
  - Risk metrics (Volatility, Sortino Ratio, Calmar Ratio)

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Recharts** - Data visualization
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository or navigate to the project directory:
```bash
cd algo-trading-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
algo-trading-frontend/
│
├── src/
│   ├── components/
│   │   ├── Navbar.tsx           # Top navigation bar
│   │   ├── Sidebar.tsx          # Side navigation menu
│   │   ├── StrategyCard.tsx     # Individual strategy card
│   │   ├── StrategyBuilder.tsx  # Strategy builder form
│   │   ├── ConditionBlock.tsx   # Individual condition block
│   │   └── Chart.tsx            # Reusable chart component
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx        # Dashboard page
│   │   ├── Strategies.tsx       # Strategies listing page
│   │   ├── Builder.tsx          # Strategy builder page
│   │   └── Backtest.tsx         # Backtesting page
│   │
│   ├── data/
│   │   └── mockStrategies.ts    # Mock data and types
│   │
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
│
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Features Highlights

### Responsive Design
- Mobile-friendly layout
- Adaptive grid systems
- Responsive charts

### Clean UI/UX
- Modern fintech aesthetic
- Intuitive navigation
- Color-coded metrics (green for profit, red for loss)
- Hover effects and transitions
- Loading states and empty states

### Type Safety
- Full TypeScript implementation
- Proper interfaces for all data structures
- Type-safe component props

### Real Trading Terminology
- NIFTY/BANKNIFTY instruments
- PnL (Profit and Loss)
- Technical indicators (EMA, RSI, VWAP, ADX, MACD)
- Risk metrics (Sharpe Ratio, Sortino Ratio, Drawdown)

## Mock Data

The application uses realistic mock data including:
- 6 pre-configured strategies
- Historical equity curve data
- Sample trade history
- Performance metrics

## Future Enhancements

- Dark mode support
- Real-time market data integration
- WebSocket connections for live updates
- More indicator options
- Advanced charting (candlesticks, indicators overlay)
- Strategy performance comparison
- Export functionality (CSV, PDF reports)
- User authentication
- Portfolio management
- Alert notifications

## License

This is a demo project for educational purposes.
