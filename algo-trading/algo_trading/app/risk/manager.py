# app/risk/manager.py
from __future__ import annotations

from dataclasses import dataclass
from app.config import settings


@dataclass
class RiskAssessment:
    approved: bool
    position_size: float
    stop_loss_price: float
    risk_amount: float
    reason: str


class RiskManager:
    def __init__(
        self,
        capital: float | None = None,
        risk_per_trade: float | None = None,
        stop_loss_pct: float | None = None,
        max_position_pct: float | None = None,
        max_open_positions: int = 10,
        max_total_exposure: float = 0.80,
    ) -> None:
        self.capital = capital or settings.INITIAL_CAPITAL
        self.risk_per_trade = risk_per_trade if risk_per_trade is not None else settings.RISK_PER_TRADE
        self.stop_loss_pct = stop_loss_pct if stop_loss_pct is not None else settings.STOP_LOSS_PCT
        self.max_position_pct = max_position_pct if max_position_pct is not None else settings.MAX_POSITION_SIZE
        self.max_open_positions = max_open_positions
        self.max_total_exposure = max_total_exposure

    def update_capital(self, new_capital: float) -> None:
        self.capital = new_capital

    def assess_trade(
        self,
        price: float,
        side: str,
        current_exposure: float = 0.0,
        open_position_count: int = 0,
    ) -> RiskAssessment:
        if price <= 0:
            return RiskAssessment(False, 0.0, 0.0, 0.0, "Invalid price")

        if open_position_count >= self.max_open_positions:
            return RiskAssessment(
                False, 0.0, 0.0, 0.0,
                f"Max open positions reached ({self.max_open_positions})",
            )

        exposure_ratio = current_exposure / self.capital if self.capital > 0 else 1.0
        if exposure_ratio >= self.max_total_exposure:
            return RiskAssessment(
                False, 0.0, 0.0, 0.0,
                f"Total exposure {exposure_ratio:.1%} exceeds limit {self.max_total_exposure:.1%}",
            )

        risk_amount = self.capital * self.risk_per_trade
        stop_distance = price * self.stop_loss_pct
        position_size = risk_amount / stop_distance if stop_distance > 0 else 0.0

        max_position_value = self.capital * self.max_position_pct
        max_qty = max_position_value / price if price > 0 else 0.0
        position_size = min(position_size, max_qty)

        remaining = (self.max_total_exposure * self.capital) - current_exposure
        max_remaining_qty = remaining / price if price > 0 else 0.0
        position_size = max(min(position_size, max_remaining_qty), 0.0)

        if position_size <= 0:
            return RiskAssessment(False, 0.0, 0.0, 0.0, "Computed position size is zero")

        if side.upper() == "BUY":
            stop_loss_price = price * (1 - self.stop_loss_pct)
        else:
            stop_loss_price = price * (1 + self.stop_loss_pct)

        return RiskAssessment(
            approved=True,
            position_size=round(position_size, 6),
            stop_loss_price=round(stop_loss_price, 4),
            risk_amount=round(risk_amount, 2),
            reason="Trade approved",
        )

    def check_drawdown(self, peak_equity: float) -> dict:
        dd = (self.capital - peak_equity) / peak_equity if peak_equity > 0 else 0.0
        return {
            "current_equity": round(self.capital, 2),
            "peak_equity": round(peak_equity, 2),
            "drawdown_pct": round(dd, 6),
            "circuit_breaker": dd < -0.20,
        }
