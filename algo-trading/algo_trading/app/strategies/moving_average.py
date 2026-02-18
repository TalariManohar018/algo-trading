# app/strategies/moving_average.py
from typing import List

import numpy as np
import pandas as pd

from app.config import settings
from app.strategies.base import BaseStrategy, Signal, TradeSignal


class MovingAverageCrossover(BaseStrategy):
    def __init__(
        self,
        short_window: int | None = None,
        long_window: int | None = None,
    ) -> None:
        self.short_window = short_window or settings.SHORT_WINDOW
        self.long_window = long_window or settings.LONG_WINDOW
        super().__init__(name=f"MA_Crossover({self.short_window},{self.long_window})")

    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[TradeSignal]:
        df = self.validate_dataframe(df)
        if len(df) < self.long_window:
            return []

        df = df.copy()
        df["sma_short"] = (
            df["close"]
            .rolling(window=self.short_window, min_periods=self.short_window)
            .mean()
        )
        df["sma_long"] = (
            df["close"]
            .rolling(window=self.long_window, min_periods=self.long_window)
            .mean()
        )
        df.dropna(subset=["sma_short", "sma_long"], inplace=True)
        if df.empty:
            return []

        df["position"] = np.where(df["sma_short"] > df["sma_long"], 1.0, -1.0)
        df["crossover"] = df["position"].diff()

        signals: List[TradeSignal] = []
        for ts, row in df.iterrows():
            cross = row["crossover"]
            if cross > 0:
                signals.append(
                    TradeSignal(
                        signal=Signal.BUY,
                        symbol=symbol,
                        price=float(row["close"]),
                        timestamp=pd.Timestamp(ts),
                        strength=1.0,
                        reason=f"SMA{self.short_window} crossed above SMA{self.long_window}",
                    )
                )
            elif cross < 0:
                signals.append(
                    TradeSignal(
                        signal=Signal.SELL,
                        symbol=symbol,
                        price=float(row["close"]),
                        timestamp=pd.Timestamp(ts),
                        strength=1.0,
                        reason=f"SMA{self.short_window} crossed below SMA{self.long_window}",
                    )
                )
        return signals


class RSIMeanReversion(BaseStrategy):
    def __init__(
        self,
        period: int = 14,
        oversold: float = 30.0,
        overbought: float = 70.0,
    ) -> None:
        self.period = period
        self.oversold = oversold
        self.overbought = overbought
        super().__init__(name=f"RSI_MeanRev({period},{oversold},{overbought})")

    @staticmethod
    def _compute_rsi(series: pd.Series, period: int) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0.0)
        loss = -delta.clip(upper=0.0)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[TradeSignal]:
        df = self.validate_dataframe(df)
        if len(df) < self.period + 1:
            return []

        df = df.copy()
        df["rsi"] = self._compute_rsi(df["close"], self.period)
        df.dropna(subset=["rsi"], inplace=True)
        df["prev_rsi"] = df["rsi"].shift(1)
        df.dropna(subset=["prev_rsi"], inplace=True)

        signals: List[TradeSignal] = []
        for ts, row in df.iterrows():
            rsi_now = row["rsi"]
            rsi_prev = row["prev_rsi"]
            if rsi_prev >= self.oversold and rsi_now < self.oversold:
                signals.append(
                    TradeSignal(
                        signal=Signal.BUY,
                        symbol=symbol,
                        price=float(row["close"]),
                        timestamp=pd.Timestamp(ts),
                        strength=min((self.oversold - rsi_now) / self.oversold, 1.0),
                        reason=f"RSI({self.period}) dropped below {self.oversold}: {rsi_now:.1f}",
                    )
                )
            elif rsi_prev <= self.overbought and rsi_now > self.overbought:
                signals.append(
                    TradeSignal(
                        signal=Signal.SELL,
                        symbol=symbol,
                        price=float(row["close"]),
                        timestamp=pd.Timestamp(ts),
                        strength=min(
                            (rsi_now - self.overbought) / (100 - self.overbought), 1.0
                        ),
                        reason=f"RSI({self.period}) rose above {self.overbought}: {rsi_now:.1f}",
                    )
                )
        return signals
