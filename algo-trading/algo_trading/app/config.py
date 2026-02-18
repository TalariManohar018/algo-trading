# app/config.py
import os
from dataclasses import dataclass


@dataclass
class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./algo_trading.db")
    INITIAL_CAPITAL: float = float(os.getenv("INITIAL_CAPITAL", "100000.0"))
    RISK_PER_TRADE: float = float(os.getenv("RISK_PER_TRADE", "0.02"))
    STOP_LOSS_PCT: float = float(os.getenv("STOP_LOSS_PCT", "0.03"))
    MAX_POSITION_SIZE: float = float(os.getenv("MAX_POSITION_SIZE", "0.10"))
    SHORT_WINDOW: int = int(os.getenv("SHORT_WINDOW", "10"))
    LONG_WINDOW: int = int(os.getenv("LONG_WINDOW", "50"))
    COMMISSION_PCT: float = float(os.getenv("COMMISSION_PCT", "0.001"))
    SLIPPAGE_PCT: float = float(os.getenv("SLIPPAGE_PCT", "0.0005"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
