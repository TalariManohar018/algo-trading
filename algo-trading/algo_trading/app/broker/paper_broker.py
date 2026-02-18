"""Paper (simulated) broker — tracks balance, fills orders instantly at given price."""

from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from app.broker.base import BaseBroker, OrderResult, PositionInfo
from app.config import Settings


class PaperBroker(BaseBroker):
    """In-memory simulated broker for paper trading.

    All orders fill immediately at the supplied price plus configurable
    slippage and commission.

    Parameters
    ----------
    initial_capital : float | None
        Starting cash (default from Settings).
    commission_pct : float | None
        Commission per trade as a fraction (default from Settings).
    slippage_pct : float | None
        Simulated slippage as a fraction (default from Settings).
    """

    def __init__(
        self,
        initial_capital: float | None = None,
        commission_pct: float | None = None,
        slippage_pct: float | None = None,
    ):
        settings = Settings()
        self.cash = initial_capital or settings.INITIAL_CAPITAL
        self.initial_capital = self.cash
        self.commission_pct = commission_pct if commission_pct is not None else settings.COMMISSION_PCT
        self.slippage_pct = slippage_pct if slippage_pct is not None else settings.SLIPPAGE_PCT
        self._positions: Dict[str, _OpenPosition] = {}
        self._trade_log: List[OrderResult] = []

    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
    ) -> OrderResult:
        """Execute an order immediately at *price* (with slippage)."""
        side = side.upper()
        order_id = str(uuid.uuid4())

        if side == "BUY":
            fill_price = price * (1 + self.slippage_pct)
        else:
            fill_price = price * (1 - self.slippage_pct)

        cost = fill_price * quantity
        commission = cost * self.commission_pct

        if side == "BUY":
            total_cost = cost + commission
            if total_cost > self.cash:
                return OrderResult(
                    order_id=order_id,
                    symbol=symbol,
                    side=side,
                    quantity=0.0,
                    price=fill_price,
                    status="REJECTED",
                    commission=0.0,
                    message=f"Insufficient funds: need {total_cost:.2f}, have {self.cash:.2f}",
                )
            self.cash -= total_cost
            if symbol in self._positions:
                pos = self._positions[symbol]
                new_qty = pos.quantity + quantity
                pos.entry_price = (
                    (pos.entry_price * pos.quantity) + (fill_price * quantity)
                ) / new_qty
                pos.quantity = new_qty
                pos.stop_loss = stop_loss
            else:
                self._positions[symbol] = _OpenPosition(
                    symbol=symbol,
                    side="BUY",
                    quantity=quantity,
                    entry_price=fill_price,
                    current_price=fill_price,
                    stop_loss=stop_loss,
                )
        else:
            if symbol not in self._positions:
                return OrderResult(
                    order_id=order_id,
                    symbol=symbol,
                    side=side,
                    quantity=0.0,
                    price=fill_price,
                    status="REJECTED",
                    commission=0.0,
                    message=f"No open position for {symbol}",
                )
            pos = self._positions[symbol]
            sell_qty = min(quantity, pos.quantity)
            proceeds = fill_price * sell_qty - commission
            self.cash += proceeds
            pos.quantity -= sell_qty
            if pos.quantity <= 1e-9:
                del self._positions[symbol]

        result = OrderResult(
            order_id=order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=round(fill_price, 4),
            status="FILLED",
            commission=round(commission, 4),
            message="Order filled",
        )
        self._trade_log.append(result)
        return result

    def close_position(self, symbol: str, price: float) -> OrderResult:
        """Close the entire position for *symbol* at *price*."""
        if symbol not in self._positions:
            return OrderResult(
                order_id=str(uuid.uuid4()),
                symbol=symbol,
                side="SELL",
                quantity=0.0,
                price=price,
                status="REJECTED",
                commission=0.0,
                message=f"No open position for {symbol}",
            )
        pos = self._positions[symbol]
        return self.place_order(symbol, "SELL", pos.quantity, price)

    def get_positions(self) -> List[PositionInfo]:
        """Return all currently open positions."""
        positions: List[PositionInfo] = []
        for pos in self._positions.values():
            pnl = (pos.current_price - pos.entry_price) * pos.quantity
            positions.append(
                PositionInfo(
                    symbol=pos.symbol,
                    side=pos.side,
                    quantity=round(pos.quantity, 6),
                    entry_price=round(pos.entry_price, 4),
                    current_price=round(pos.current_price, 4),
                    unrealized_pnl=round(pnl, 2),
                    stop_loss=pos.stop_loss,
                )
            )
        return positions

    def update_price(self, symbol: str, price: float) -> None:
        """Update the mark-to-market price for an open position."""
        if symbol in self._positions:
            self._positions[symbol].current_price = price

    def get_balance(self) -> float:
        """Return cash on hand."""
        return round(self.cash, 2)

    def get_portfolio_value(self) -> float:
        """Return total equity (cash + open position value)."""
        position_value = sum(
            p.current_price * p.quantity for p in self._positions.values()
        )
        return round(self.cash + position_value, 2)

    def get_trade_log(self) -> List[dict]:
        """Return a list of all executed orders."""
        return [
            {
                "order_id": r.order_id,
                "symbol": r.symbol,
                "side": r.side,
                "quantity": r.quantity,
                "price": r.price,
                "status": r.status,
                "commission": r.commission,
                "message": r.message,
            }
            for r in self._trade_log
        ]

    def reset(self) -> None:
        """Reset the broker to initial state."""
        self.cash = self.initial_capital
        self._positions.clear()
        self._trade_log.clear()


class _OpenPosition:
    """Internal mutable position record."""

    __slots__ = ("symbol", "side", "quantity", "entry_price", "current_price", "stop_loss")

    def __init__(
        self,
        symbol: str,
        side: str,
        quantity: float,
        entry_price: float,
        current_price: float,
        stop_loss: float | None,
    ):
        self.symbol = symbol
        self.side = side
        self.quantity = quantity
        self.entry_price = entry_price
        self.current_price = current_price
        self.stop_loss = stop_loss
