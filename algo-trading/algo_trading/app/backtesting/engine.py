# app/backtesting/engine.py
from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
import pandas as pd

from app.config import settings
from app.strategies.base import BaseStrategy, Signal


@dataclass
class BacktestTrade:
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    quantity: float
    entry_time: str
    exit_time: str
    pnl: float
    commission: float
    return_pct: float


@dataclass
class BacktestResult:
    strategy_name: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float
    final_equity: float
    total_return_pct: float
    annualized_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    trades: List[BacktestTrade] = field(default_factory=list)
    equity_curve: List[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "strategy_name": self.strategy_name,
            "symbol": self.symbol,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "initial_capital": round(self.initial_capital, 2),
            "final_equity": round(self.final_equity, 2),
            "total_return_pct": round(self.total_return_pct, 4),
            "annualized_return_pct": round(self.annualized_return_pct, 4),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "max_drawdown_pct": round(self.max_drawdown_pct, 4),
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 4),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "profit_factor": round(self.profit_factor, 4),
            "trades": [t.__dict__ for t in self.trades],
            "equity_curve": self.equity_curve,
        }


class BacktestEngine:
    def __init__(
        self,
        strategy: BaseStrategy,
        initial_capital: Optional[float] = None,
        commission_pct: Optional[float] = None,
        slippage_pct: Optional[float] = None,
        risk_per_trade: Optional[float] = None,
        stop_loss_pct: Optional[float] = None,
    ) -> None:
        self.strategy = strategy
        self.initial_capital = initial_capital or settings.INITIAL_CAPITAL
        self.commission_pct = commission_pct if commission_pct is not None else settings.COMMISSION_PCT
        self.slippage_pct = slippage_pct if slippage_pct is not None else settings.SLIPPAGE_PCT
        self.risk_per_trade = risk_per_trade if risk_per_trade is not None else settings.RISK_PER_TRADE
        self.stop_loss_pct = stop_loss_pct if stop_loss_pct is not None else settings.STOP_LOSS_PCT

    def run(self, df: pd.DataFrame, symbol: str) -> BacktestResult:
        df = self.strategy.validate_dataframe(df)
        signals = self.strategy.generate_signals(df, symbol)

        capital = self.initial_capital
        position_qty = 0.0
        entry_price = 0.0
        entry_time = ""
        trades: List[BacktestTrade] = []
        equity_curve: List[dict] = []

        signal_map: dict[str, Signal] = {}
        for sig in signals:
            signal_map[sig.timestamp.isoformat()] = sig.signal

        for ts, row in df.iterrows():
            close = float(row["close"])
            ts_str = pd.Timestamp(ts).isoformat()
            sig = signal_map.get(ts_str, Signal.HOLD)

            # Check stop-loss
            if position_qty > 0:
                stop_price = entry_price * (1 - self.stop_loss_pct)
                if close <= stop_price:
                    exit_price = close * (1 - self.slippage_pct)
                    commission = exit_price * position_qty * self.commission_pct
                    pnl = (exit_price - entry_price) * position_qty - commission
                    ret_pct = (exit_price - entry_price) / entry_price if entry_price else 0
                    trades.append(BacktestTrade(
                        symbol=symbol, side="BUY",
                        entry_price=round(entry_price, 4),
                        exit_price=round(exit_price, 4),
                        quantity=round(position_qty, 6),
                        entry_time=entry_time, exit_time=ts_str,
                        pnl=round(pnl, 2), commission=round(commission, 2),
                        return_pct=round(ret_pct, 6),
                    ))
                    capital += pnl
                    position_qty = 0.0
                    entry_price = 0.0

            # Process signals
            if sig == Signal.BUY and position_qty == 0:
                buy_price = close * (1 + self.slippage_pct)
                risk_amount = capital * self.risk_per_trade
                stop_dist = buy_price * self.stop_loss_pct
                qty = risk_amount / stop_dist if stop_dist > 0 else 0
                max_qty = (capital * 0.95) / buy_price if buy_price > 0 else 0
                qty = min(qty, max_qty)
                if qty > 0:
                    commission = buy_price * qty * self.commission_pct
                    capital -= commission
                    position_qty = qty
                    entry_price = buy_price
                    entry_time = ts_str

            elif sig == Signal.SELL and position_qty > 0:
                exit_price = close * (1 - self.slippage_pct)
                commission = exit_price * position_qty * self.commission_pct
                pnl = (exit_price - entry_price) * position_qty - commission
                ret_pct = (exit_price - entry_price) / entry_price if entry_price else 0
                trades.append(BacktestTrade(
                    symbol=symbol, side="BUY",
                    entry_price=round(entry_price, 4),
                    exit_price=round(exit_price, 4),
                    quantity=round(position_qty, 6),
                    entry_time=entry_time, exit_time=ts_str,
                    pnl=round(pnl, 2), commission=round(commission, 2),
                    return_pct=round(ret_pct, 6),
                ))
                capital += pnl
                position_qty = 0.0
                entry_price = 0.0

            mark = capital + (position_qty * close if position_qty > 0 else 0)
            equity_curve.append({"date": ts_str, "equity": round(mark, 2)})

        # Close remaining position at last bar
        if position_qty > 0:
            last_close = float(df.iloc[-1]["close"])
            exit_price = last_close * (1 - self.slippage_pct)
            commission = exit_price * position_qty * self.commission_pct
            pnl = (exit_price - entry_price) * position_qty - commission
            ret_pct = (exit_price - entry_price) / entry_price if entry_price else 0
            trades.append(BacktestTrade(
                symbol=symbol, side="BUY",
                entry_price=round(entry_price, 4),
                exit_price=round(exit_price, 4),
                quantity=round(position_qty, 6),
                entry_time=entry_time,
                exit_time=pd.Timestamp(df.index[-1]).isoformat(),
                pnl=round(pnl, 2), commission=round(commission, 2),
                return_pct=round(ret_pct, 6),
            ))
            capital += pnl

        return self._compute_stats(capital, trades, equity_curve, symbol, df)

    def run_from_csv(self, csv_text: str, symbol: str) -> BacktestResult:
        df = pd.read_csv(io.StringIO(csv_text))
        return self.run(df, symbol)

    def _compute_stats(
        self,
        final_capital: float,
        trades: List[BacktestTrade],
        equity_curve: List[dict],
        symbol: str,
        df: pd.DataFrame,
    ) -> BacktestResult:
        total_return = (final_capital - self.initial_capital) / self.initial_capital

        ann_return = 0.0
        sharpe = 0.0
        max_dd = 0.0

        if len(equity_curve) > 1:
            equities = pd.Series([e["equity"] for e in equity_curve])
            daily_returns = equities.pct_change().dropna()
            trading_days = len(equity_curve)
            years = trading_days / 252 if trading_days > 0 else 1
            ann_return = (1 + total_return) ** (1 / max(years, 0.01)) - 1
            if daily_returns.std() > 0:
                sharpe = float((daily_returns.mean() / daily_returns.std()) * np.sqrt(252))
            running_max = equities.cummax()
            drawdown = (equities - running_max) / running_max
            max_dd = float(drawdown.min())

        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]
        avg_win = float(np.mean([t.pnl for t in wins])) if wins else 0.0
        avg_loss = float(np.mean([abs(t.pnl) for t in losses])) if losses else 0.0
        total_win_pnl = sum(t.pnl for t in wins)
        total_loss_pnl = sum(abs(t.pnl) for t in losses)
        profit_factor = total_win_pnl / total_loss_pnl if total_loss_pnl > 0 else 9999.99

        start_date = str(df.index[0]) if len(df) > 0 else ""
        end_date = str(df.index[-1]) if len(df) > 0 else ""

        return BacktestResult(
            strategy_name=self.strategy.name,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=self.initial_capital,
            final_equity=round(final_capital, 2),
            total_return_pct=total_return,
            annualized_return_pct=ann_return,
            sharpe_ratio=sharpe,
            max_drawdown_pct=max_dd,
            total_trades=len(trades),
            winning_trades=len(wins),
            losing_trades=len(losses),
            win_rate=len(wins) / len(trades) if trades else 0.0,
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            trades=trades,
            equity_curve=equity_curve,
        )
