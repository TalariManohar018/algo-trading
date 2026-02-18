# app/services/trading_service.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.broker.base import BaseBroker, PositionInfo
from app.models.trade import Position, Trade
from app.risk.manager import RiskManager
from app.strategies.base import BaseStrategy, Signal


@dataclass
class TradingResult:
    executed: int = 0
    rejected: int = 0
    details: List[dict] = field(default_factory=list)


class TradingService:
    def __init__(
        self,
        strategy: BaseStrategy,
        broker: BaseBroker,
        risk_manager: RiskManager,
        db: Optional[Session] = None,
    ) -> None:
        self.strategy = strategy
        self.broker = broker
        self.risk_manager = risk_manager
        self.db = db
        self.peak_equity = broker.get_portfolio_value()

    def process_bar(self, df: pd.DataFrame, symbol: str) -> TradingResult:
        signals = self.strategy.generate_signals(df, symbol)
        result = TradingResult()

        for sig in signals:
            if sig.signal == Signal.HOLD:
                continue

            positions = self.broker.get_positions()
            exposure = sum(p.current_price * p.quantity for p in positions)

            if sig.signal == Signal.BUY:
                assessment = self.risk_manager.assess_trade(sig.price, "BUY", exposure, len(positions))
                if not assessment.approved:
                    result.rejected += 1
                    result.details.append({"signal": "BUY", "symbol": sig.symbol, "status": "REJECTED", "reason": assessment.reason})
                    continue
                order = self.broker.place_order(sig.symbol, "BUY", assessment.position_size, sig.price, assessment.stop_loss_price)
                if order.status == "FILLED":
                    result.executed += 1
                    self._save_trade(order)
                    self._save_position(order, assessment.stop_loss_price)
                    self.risk_manager.update_capital(self.broker.get_balance())
                else:
                    result.rejected += 1
                result.details.append({"signal": "BUY", "symbol": sig.symbol, "status": order.status, "qty": order.quantity, "price": order.price})

            elif sig.signal == Signal.SELL:
                order = self.broker.close_position(sig.symbol, sig.price)
                if order.status == "FILLED":
                    result.executed += 1
                    pnl = self._calc_pnl(sig.symbol, order.price, order.quantity, positions)
                    self._save_trade(order, pnl)
                    self._del_position(sig.symbol)
                    self.risk_manager.update_capital(self.broker.get_balance())
                else:
                    result.rejected += 1
                result.details.append({"signal": "SELL", "symbol": sig.symbol, "status": order.status, "qty": order.quantity, "price": order.price})

            val = self.broker.get_portfolio_value()
            if val > self.peak_equity:
                self.peak_equity = val

        return result

    def get_performance(self) -> dict:
        pv = self.broker.get_portfolio_value()
        cash = self.broker.get_balance()
        positions = self.broker.get_positions()
        pos_val = sum(p.current_price * p.quantity for p in positions)
        cap = self.risk_manager.capital
        ret = (pv - cap) / cap if cap > 0 else 0.0
        dd = self.risk_manager.check_drawdown(self.peak_equity)
        return {
            "portfolio_value": round(pv, 2),
            "cash": round(cash, 2),
            "position_value": round(pos_val, 2),
            "total_return_pct": round(ret, 6),
            "drawdown_pct": dd["drawdown_pct"],
            "peak_equity": dd["peak_equity"],
            "open_positions": len(positions),
            "strategy": self.strategy.name,
        }

    def _calc_pnl(self, symbol: str, exit_price: float, qty: float, positions: List[PositionInfo]) -> float:
        for p in positions:
            if p.symbol == symbol:
                return (exit_price - p.entry_price) * qty
        return 0.0

    def _save_trade(self, order, pnl: float = 0.0) -> None:
        if self.db is None:
            return
        self.db.add(Trade(symbol=order.symbol, side=order.side, quantity=order.quantity, price=order.price, commission=order.commission, pnl=pnl, status=order.status, strategy=self.strategy.name))
        self.db.commit()

    def _save_position(self, order, stop_loss: float) -> None:
        if self.db is None:
            return
        ex = self.db.query(Position).filter(Position.symbol == order.symbol).first()
        if ex:
            nq = ex.quantity + order.quantity
            ex.entry_price = (ex.entry_price * ex.quantity + order.price * order.quantity) / nq
            ex.quantity = nq
            ex.current_price = order.price
            ex.stop_loss = stop_loss
        else:
            self.db.add(Position(symbol=order.symbol, side=order.side, quantity=order.quantity, entry_price=order.price, current_price=order.price, stop_loss=stop_loss))
        self.db.commit()

    def _del_position(self, symbol: str) -> None:
        if self.db is None:
            return
        p = self.db.query(Position).filter(Position.symbol == symbol).first()
        if p:
            self.db.delete(p)
            self.db.commit()
