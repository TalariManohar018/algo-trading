# app/broker/paper_broker.py
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from app.broker.base import BaseBroker, OrderResult, PositionInfo
from app.config import settings


class _OpenPos:
    __slots__ = ("symbol", "side", "quantity", "entry_price", "current_price", "stop_loss")

    def __init__(self, symbol: str, side: str, quantity: float, entry_price: float, current_price: float, stop_loss: float | None) -> None:
        self.symbol = symbol
        self.side = side
        self.quantity = quantity
        self.entry_price = entry_price
        self.current_price = current_price
        self.stop_loss = stop_loss


class PaperBroker(BaseBroker):
    def __init__(
        self,
        initial_capital: float | None = None,
        commission_pct: float | None = None,
        slippage_pct: float | None = None,
    ) -> None:
        self.initial_capital = initial_capital or settings.INITIAL_CAPITAL
        self.cash = self.initial_capital
        self.commission_pct = commission_pct if commission_pct is not None else settings.COMMISSION_PCT
        self.slippage_pct = slippage_pct if slippage_pct is not None else settings.SLIPPAGE_PCT
        self._positions: Dict[str, _OpenPos] = {}
        self._trade_log: List[OrderResult] = []

    def place_order(self, symbol: str, side: str, quantity: float, price: float, stop_loss: Optional[float] = None) -> OrderResult:
        side = side.upper()
        oid = str(uuid.uuid4())

        fill = price * (1 + self.slippage_pct) if side == "BUY" else price * (1 - self.slippage_pct)
        cost = fill * quantity
        comm = cost * self.commission_pct

        if side == "BUY":
            if cost + comm > self.cash:
                return OrderResult(oid, symbol, side, 0, fill, "REJECTED", 0, f"Insufficient funds: need {cost+comm:.2f}, have {self.cash:.2f}")
            self.cash -= cost + comm
            if symbol in self._positions:
                p = self._positions[symbol]
                new_qty = p.quantity + quantity
                p.entry_price = (p.entry_price * p.quantity + fill * quantity) / new_qty
                p.quantity = new_qty
                p.stop_loss = stop_loss
            else:
                self._positions[symbol] = _OpenPos(symbol, "BUY", quantity, fill, fill, stop_loss)
        else:
            if symbol not in self._positions:
                return OrderResult(oid, symbol, side, 0, fill, "REJECTED", 0, f"No open position for {symbol}")
            p = self._positions[symbol]
            sell_qty = min(quantity, p.quantity)
            self.cash += fill * sell_qty - comm
            p.quantity -= sell_qty
            if p.quantity <= 1e-9:
                del self._positions[symbol]

        r = OrderResult(oid, symbol, side, quantity, round(fill, 4), "FILLED", round(comm, 4), "Order filled")
        self._trade_log.append(r)
        return r

    def close_position(self, symbol: str, price: float) -> OrderResult:
        if symbol not in self._positions:
            return OrderResult(str(uuid.uuid4()), symbol, "SELL", 0, price, "REJECTED", 0, f"No position for {symbol}")
        return self.place_order(symbol, "SELL", self._positions[symbol].quantity, price)

    def get_positions(self) -> List[PositionInfo]:
        out: List[PositionInfo] = []
        for p in self._positions.values():
            pnl = (p.current_price - p.entry_price) * p.quantity
            out.append(PositionInfo(p.symbol, p.side, round(p.quantity, 6), round(p.entry_price, 4), round(p.current_price, 4), round(pnl, 2), p.stop_loss))
        return out

    def update_price(self, symbol: str, price: float) -> None:
        if symbol in self._positions:
            self._positions[symbol].current_price = price

    def get_balance(self) -> float:
        return round(self.cash, 2)

    def get_portfolio_value(self) -> float:
        pos_val = sum(p.current_price * p.quantity for p in self._positions.values())
        return round(self.cash + pos_val, 2)

    def get_trade_log(self) -> List[dict]:
        return [{"order_id": r.order_id, "symbol": r.symbol, "side": r.side, "quantity": r.quantity, "price": r.price, "status": r.status, "commission": r.commission, "message": r.message} for r in self._trade_log]

    def reset(self) -> None:
        self.cash = self.initial_capital
        self._positions.clear()
        self._trade_log.clear()
