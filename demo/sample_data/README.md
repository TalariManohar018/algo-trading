# Sample Market Data for Demo Backtesting

This directory contains sample CSV files with mock market data for running demo backtests.

## Files

- `RELIANCE.csv` - Reliance Industries Ltd. sample prices
- `INFY.csv` - Infosys Ltd. sample prices
- `TCS.csv` - Tata Consultancy Services sample prices

## Format

All files follow the standard OHLCV format:
```
Date,Open,High,Low,Close,Volume
```

## Usage

These files are used by:
1. Demo backtest script (`scripts/run_demo_backtest.sh` or `.ps1`)
2. Integration tests
3. Local development and testing

## Note

This is **simulated data** for testing purposes only. Not real market data.
