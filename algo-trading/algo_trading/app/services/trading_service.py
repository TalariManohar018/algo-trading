"""Trading service — orchestrates strategy signals, risk checks, and broker execution."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.broker.base import BaseBroker, PositionInfo
from app.config import Settings
from app.models.trade import OrderSide, OrderStatus, Position, Trade
from app.risk.manager import RiskManager
from app.strategies.base import BaseStrategy, Signal


@dataclass
class TradingResult:
    """Summary returned after processing a single bar / signal batch."""
    executed: int = 0
    rejected: int = 0
    details: List[dict] = field(default_factory=list)


class TradingService:
    """High-level orchestrator: strategy -> risk -> broker -> persistence.

    Parameters
    ----------
    strategy : BaseStrategy
        Strategy instance that generates signals.
    broker : BaseBroker
        Broker adapter (paper or live) that executes orders.
    risk_manager : RiskManager
        Risk manager that sizes positions and enforces limits.
    db : Session | None
        Optional SQLAlchemy session for persisting trades.
    """

    def __init__(
        self,
        strategy: BaseStrategy,
        broker: BaseBroker,
        risk_manager: RiskManager,
        db: Optional[Session] = None,
    ):
        self.strategy = strategy
        self.broker = broker
        self.risk_manager = risk_manager
        self.db = db
        self.peak_equity = broker.get_portfolio_value()

    def process_bar(self, df: pd.DataFrame, symbol: str) -> TradingResult:
        """Run strategy on *df*, execute approved trades, and return results.

        This is the main entry point for live / paper trading loops.
        """
        signals = self.strategy.generate_signals(df, symbol)
        result = TradingResult()

        for sig in signals:
            if sig.signal == Signal.HOLD:
                continue

            positions = self.broker.get_positions()
            current_exposure = sum(p.current_price * p.quantity for p in positions)
            open_count = len(positions)

            if sig.signal == Signal.BUY:
                assessment = self.risk_manager.assess_trade(
                    price=sig.price,
                    side="BUY",
                    current_exposure=current_exposure,
                    open_position_count=open_count,
                )
                if not assessment.approved:
                    result.rejected += 1
                    result.details.append({
                        "signal": sig.signal.value,
                        "symbol": sig.symbol,
                        "status": "REJECTED",
                        "reason": assessment.reason,
                    })
                    continue

                order = self.broker.place_order(
                    symbol=sig.symbol,
                    side="BUY",
                    quantity=assessment.position_size,
                    price=sig.price,
                    stop_loss=assessment.stop_loss_price,
                )
                if order.status == "FILLED":
                    result.executed += 1
                    self._persist_trade(order, sig)
                    self._persist_position(order, assessment.stop_loss_price)
                    self.risk_manager.update_capital(self.broker.get_balance())
                else:
                    result.rejected += 1

                result.details.append({
                    "signal": sig.signal.value,
                    "symbol": sig.symbol,
                    "status": order.status,
                    "quantity": order.quantity,
                    "price": order.price,
                    "message": order.message,
                })

            elif sig.signal == Signal.SELL:
                order = self.broker.close_position(sig.symbol, sig.price)
                if order.status == "FILLED":
                    result.executed += 1
                    pnl = self._calculate_pnl(sig.symbol, order.price, order.quantity, positions)
                    self._persist_trade(order, sig, pnl)
                    self._remove_position(sig.symbol)
                    self.risk_manager.update_capital(self.broker.get_balance())
                else:
                    result.rejected += 1

                result.details.append({
                    "signal": sig.signal.value,
                    "symbol": sig.symbol,
                    "status": order.status,
                    "quantity": order.quantity,
                    "price": order.price,
                    "message": order.message,
                })

            current_value = self.broker.get_portfolio_value()
            if current_value > self.peak_equity:
                self.peak_equity = current_value

        return result

    def get_performance(self) -> dict:
        """Return real-time performance snapshot."""
        portfolio_value = self.broker.get_portfolio_value()
        cash = self.broker.get_balance()
        positions = self.broker.get_positions()
        position_value = sum(p.current_price * p.quantity for p in positions)

        total_return = (portfolio_value - self.risk_manager.capital) / self.risk_manager.capital if self.risk_manager.capital > 0 else 0.0
        dd = self.risk_manager.check_drawdown(self.peak_equity)

        return {
            "portfolio_value": round(portfolio_value, 2),
            "cash": round(cash, 2),
            "position_value": round(position_value, 2),
            "total_return_pct": round(total_return, 6),
            "drawdown_pct": dd["drawdown_pct"],
            "peak_equity": dd["peak_equity"],
            "open_positions": len(positions),
            "strategy": self.strategy.name,
        }

    def _calculate_pnl(
        self, symbol: str, exit_price: float, quantity: float, positions: List[PositionInfo]
    ) -> float:
        for pos in positions:
            if pos.symbol == symbol:
                return (exit_price - pos.entry_price) * quantity
        return 0.0

    def _persist_trade(self, order, sig, pnl: float = 0.0) -> None:
        if self.db is None:
            return
        trade = Trade(
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=order.price,
            commission=order.commission,
            pnl=pnl,
            status=order.status,
            strategy=self.strategy.name,
        )
        self.db.add(trade)
        self.db.commit()

    def _persist_position(self, order, stop_loss: float) -> None:
        if self.db is None:
            return
        existing = self.db.query(Position).filter(Position.symbol == order.symbol).first()
        if existing:
            new_qty = existing.quantity + order.quantity
            existing.entry_price = (
                (existing.entry_price * existing.quantity) + (order.price * order.quantity)
            ) / new_qty
            existing.quantity = new_qty
            existing.current_price = order.price
            existing.stop_loss = stop_loss
        else:
            pos = Position(
                symbol=order.symbol,
                side=order.side,
                quantity=order.quantity,
                entry_price=order.price,
                current_price=order.price,
                stop_loss=stop_loss,
            )
            self.db.add(pos)
        self.db.commit()

    def _remove_position(self, symbol: str) -> None:
        if self.db is None:
            return
        pos = self.db.query(Position).filter(Position.symbol == symbol).first()
        if pos:
            self.db.delete(pos)
            self.db.commit()
