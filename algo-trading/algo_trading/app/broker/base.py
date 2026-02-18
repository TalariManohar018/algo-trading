"""Abstract broker interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class OrderResult:
    """Return value from a broker order submission."""
    order_id: str
    symbol: str
    side: str
    quantity: float
    price: float
    status: str
    commission: float
    message: str


@dataclass
class PositionInfo:
    """Snapshot of a single open position."""
    symbol: str
    side: str
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    stop_loss: Optional[float] = None


class BaseBroker(ABC):
    """Interface every broker adapter must implement."""

    @abstractmethod
    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
    ) -> OrderResult:
        """Submit a market / limit order."""

    @abstractmethod
    def get_positions(self) -> List[PositionInfo]:
        """Return all open positions."""

    @abstractmethod
    def close_position(self, symbol: str, price: float) -> OrderResult:
        """Close an existing position at *price*."""

    @abstractmethod
    def get_balance(self) -> float:
        """Return current cash balance."""

    @abstractmethod
    def get_portfolio_value(self) -> float:
        """Return total portfolio value (cash + positions)."""
