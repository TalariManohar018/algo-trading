# app/models/trade.py
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String
from app.database import Base


class OrderSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Trade(Base):
    __tablename__ = "trades"

    id = Column(String, primary_key=True, default=_uuid)
    symbol = Column(String, nullable=False, index=True)
    side = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    commission = Column(Float, nullable=False, default=0.0)
    slippage = Column(Float, nullable=False, default=0.0)
    pnl = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default=OrderStatus.FILLED.value)
    strategy = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": self.price,
            "stop_loss": self.stop_loss,
            "commission": self.commission,
            "slippage": self.slippage,
            "pnl": self.pnl,
            "status": self.status,
            "strategy": self.strategy,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Position(Base):
    __tablename__ = "positions"

    id = Column(String, primary_key=True, default=_uuid)
    symbol = Column(String, nullable=False, index=True, unique=True)
    side = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    unrealized_pnl = Column(Float, nullable=False, default=0.0)
    opened_at = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "entry_price": self.entry_price,
            "current_price": self.current_price,
            "stop_loss": self.stop_loss,
            "unrealized_pnl": self.unrealized_pnl,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
        }
