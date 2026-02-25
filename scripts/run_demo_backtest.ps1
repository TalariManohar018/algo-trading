# ============================================================
# DEMO BACKTEST SCRIPT (PowerShell)
# ============================================================
# Runs a sample backtest using mock market data
# Output: demo/output.json

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Algo Trading - Demo Backtest" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Navigate to Python project directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptPath "..\algo-trading\algo_trading"
Set-Location $projectPath

Write-Host "`n📦 Setting up Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "✅ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "✅ Virtual environment exists" -ForegroundColor Green
}

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"

Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

Write-Host "🚀 Running demo backtest..." -ForegroundColor Yellow

# Run the Python backtest script
python -c @"
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.broker.paper_broker import PaperBroker
from app.strategies.moving_average import MovingAverageStrategy

print('Initializing backtest environment...')

# Initialize paper broker with demo capital
broker = PaperBroker(initial_capital=100000.0, commission_pct=0.001, slippage_pct=0.0005)

print(f'Initial capital: ₹{broker.initial_capital:,.2f}')

# Simulate some trades using sample data
results = {
    'backtest_date': datetime.now().isoformat(),
    'strategy': 'MovingAverage',
    'initial_capital': broker.initial_capital,
    'trades': [],
    'summary': {}
}

# Sample trades - Buy low, sell high simulation
sample_trades = [
    {'symbol': 'RELIANCE', 'side': 'BUY', 'qty': 10, 'price': 2450.0},
    {'symbol': 'INFY', 'side': 'BUY', 'qty': 50, 'price': 1480.0},
    {'symbol': 'TCS', 'side': 'BUY', 'qty': 30, 'price': 3450.0},
    {'symbol': 'RELIANCE', 'side': 'SELL', 'qty': 10, 'price': 2520.0},
    {'symbol': 'INFY', 'side': 'SELL', 'qty': 50, 'price': 1510.0},
    {'symbol': 'TCS', 'side': 'SELL', 'qty': 30, 'price': 3500.0},
]

print(f'\nExecuting {len(sample_trades)} sample trades...')
for i, trade in enumerate(sample_trades, 1):
    print(f'  [{i}] {trade["side"]} {trade["qty"]} {trade["symbol"]} @ ₹{trade["price"]}')
    
    order_result = broker.place_order(
        symbol=trade['symbol'],
        side=trade['side'],
        quantity=trade['qty'],
        price=trade['price']
    )
    
    results['trades'].append({
        'order_id': order_result.order_id,
        'symbol': order_result.symbol,
        'side': order_result.side,
        'quantity': order_result.quantity,
        'price': order_result.price,
        'status': order_result.status,
        'commission': order_result.commission,
        'message': order_result.message
    })

# Calculate summary statistics
final_balance = broker.get_balance()
total_pnl = final_balance - broker.initial_capital
total_commissions = sum(t.commission for t in broker._trade_log)
winning_trades = sum(1 for t in broker._trade_log if t.side == 'SELL' and t.status == 'FILLED')
total_trades = len([t for t in broker._trade_log if t.status == 'FILLED'])

results['summary'] = {
    'final_balance': round(final_balance, 2),
    'total_pnl': round(total_pnl, 2),
    'pnl_percentage': round((total_pnl / broker.initial_capital) * 100, 2),
    'total_commissions': round(total_commissions, 2),
    'total_trades': total_trades,
    'winning_trades': winning_trades,
    'win_rate': round((winning_trades / (total_trades / 2)) * 100, 2) if total_trades > 0 else 0
}

print('\n' + '='*50)
print('📊 BACKTEST RESULTS')
print('='*50)
print(f'Initial Capital:     ₹{broker.initial_capital:,.2f}')
print(f'Final Balance:       ₹{final_balance:,.2f}')
print(f'Total P&L:          ₹{total_pnl:,.2f} ({results["summary"]["pnl_percentage"]}%)')
print(f'Total Commissions:   ₹{total_commissions:,.2f}')
print(f'Total Trades:        {total_trades}')
print(f'Win Rate:            {results["summary"]["win_rate"]}%')
print('='*50)

# Create demo directory if it doesn't exist
demo_dir = Path(__file__).resolve().parent.parent.parent / 'demo'
demo_dir.mkdir(exist_ok=True)

# Write results to JSON
output_file = demo_dir / 'output.json'
with open(output_file, 'w') as f:
    json.dump(results, f, indent=2)

print(f'\n✅ Results written to: {output_file}')
print('Demo backtest completed successfully!')
"@

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  Demo Backtest Complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "📄 Output file: demo\output.json" -ForegroundColor Green
Write-Host ""
