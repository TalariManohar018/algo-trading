# app/broker/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class OrderResult:
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
    symbol: str
    side: str
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    stop_loss: Optional[float] = None


class BaseBroker(ABC):
    @abstractmethod
    def place_order(self, symbol: str, side: str, quantity: float, price: float, stop_loss: Optional[float] = None) -> OrderResult:
        pass

    @abstractmethod
    def get_positions(self) -> List[PositionInfo]:
        pass

    @abstractmethod
    def close_position(self, symbol: str, price: float) -> OrderResult:
        pass

    @abstractmethod
    def get_balance(self) -> float:
        pass

    @abstractmethod
    def get_portfolio_value(self) -> float:
        pass
