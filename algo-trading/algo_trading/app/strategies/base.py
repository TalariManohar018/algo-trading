"""Base strategy interface for all trading strategies."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List

import pandas as pd


class Signal(str, Enum):
    """Trading signal emitted by a strategy."""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class TradeSignal:
    """Represents a single trading signal with metadata."""
    signal: Signal
    symbol: str
    price: float
    timestamp: pd.Timestamp
    strength: float = 1.0
    reason: str = ""


class BaseStrategy(ABC):
    """Abstract base class for all trading strategies.

    Every strategy must implement `generate_signals`, which receives
    an OHLCV DataFrame and returns a list of TradeSignal objects.
    """

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[TradeSignal]:
        """Analyse *df* and return trading signals.

        Parameters
        ----------
        df : pd.DataFrame
            Must contain columns: open, high, low, close, volume.
            Index should be a DatetimeIndex or a 'date' / 'timestamp' column.
        symbol : str
            The ticker / instrument identifier.

        Returns
        -------
        List[TradeSignal]
            Zero or more signals for the current bar(s).
        """

    def validate_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensure required columns exist and normalise column names."""
        df = df.copy()
        df.columns = [c.strip().lower() for c in df.columns]
        required = {"open", "high", "low", "close", "volume"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"DataFrame missing columns: {missing}")
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df.dropna(subset=["close"], inplace=True)
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
            df.set_index("date", inplace=True)
        elif "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df.set_index("timestamp", inplace=True)
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        df.sort_index(inplace=True)
        return df
