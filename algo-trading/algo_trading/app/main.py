"""FastAPI application — main entry point with all REST endpoints."""

from __future__ import annotations

import io
from contextlib import asynccontextmanager
from typing import List, Optional

import pandas as pd
import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backtesting.engine import BacktestEngine
from app.broker.paper_broker import PaperBroker
from app.config import Settings
from app.database import get_db, init_db
from app.models.trade import Position, Trade
from app.risk.manager import RiskManager
from app.services.trading_service import TradingService
from app.strategies.moving_average import MovingAverageCrossover, RSIMeanReversion

settings = Settings()

broker = PaperBroker(
    initial_capital=settings.INITIAL_CAPITAL,
    commission_pct=settings.COMMISSION_PCT,
    slippage_pct=settings.SLIPPAGE_PCT,
)

risk_mgr = RiskManager(capital=settings.INITIAL_CAPITAL)

strategies = {
    "ma_crossover": MovingAverageCrossover(),
    "rsi_mean_reversion": RSIMeanReversion(),
}


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup / shutdown hooks."""
    init_db()
    yield


app = FastAPI(
    title="Algo Trading Engine",
    version="1.0.0",
    description="Production algorithmic trading backend — FastAPI + Pandas + SQLAlchemy",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    """Request body for the /backtest endpoint."""
    strategy: str = Field("ma_crossover", description="Strategy key: ma_crossover | rsi_mean_reversion")
    symbol: str = Field("AAPL", description="Instrument symbol")
    short_window: Optional[int] = Field(None, description="MA short window (ma_crossover only)")
    long_window: Optional[int] = Field(None, description="MA long window (ma_crossover only)")
    rsi_period: Optional[int] = Field(None, description="RSI period (rsi_mean_reversion only)")
    initial_capital: Optional[float] = Field(None, description="Starting equity")
    csv_data: Optional[str] = Field(None, description="Inline OHLCV CSV string (alternative to file upload)")


class TradeRequest(BaseModel):
    """Request body for the /trade endpoint."""
    symbol: str = Field(..., description="Instrument symbol")
    side: str = Field(..., description="BUY or SELL")
    quantity: Optional[float] = Field(None, description="Quantity (auto-sized by risk manager if omitted)")
    price: float = Field(..., description="Current market price")


class HealthResponse(BaseModel):
    status: str
    version: str


@app.get("/", response_model=HealthResponse)
def health_check():
    """Root health-check endpoint."""
    return HealthResponse(status="ok", version="1.0.0")


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", version="1.0.0")


@app.get("/strategies")
def list_strategies():
    """Return available strategies and their parameters."""
    return {
        "strategies": [
            {
                "key": "ma_crossover",
                "name": strategies["ma_crossover"].name,
                "params": {"short_window": settings.SHORT_WINDOW, "long_window": settings.LONG_WINDOW},
            },
            {
                "key": "rsi_mean_reversion",
                "name": strategies["rsi_mean_reversion"].name,
                "params": {"period": 14, "oversold": 30, "overbought": 70},
            },
        ]
    }


@app.post("/backtest")
def run_backtest(req: BacktestRequest):
    """Run a backtest on OHLCV data with the selected strategy.

    You may supply CSV data inline via *csv_data* or as a string.
    For file upload use the /backtest/upload endpoint.
    """
    if req.csv_data is None:
        raise HTTPException(status_code=400, detail="csv_data is required (OHLCV CSV string)")

    strat = _resolve_strategy(req)
    engine = BacktestEngine(
        strategy=strat,
        initial_capital=req.initial_capital or settings.INITIAL_CAPITAL,
    )
    try:
        result = engine.run_from_csv(req.csv_data, req.symbol)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result.to_dict()


@app.post("/backtest/upload")
async def run_backtest_upload(
    file: UploadFile = File(...),
    strategy: str = Query("ma_crossover"),
    symbol: str = Query("AAPL"),
    short_window: Optional[int] = Query(None),
    long_window: Optional[int] = Query(None),
    rsi_period: Optional[int] = Query(None),
    initial_capital: Optional[float] = Query(None),
):
    """Run a backtest from an uploaded CSV file."""
    content = await file.read()
    csv_text = content.decode("utf-8")

    req = BacktestRequest(
        strategy=strategy,
        symbol=symbol,
        short_window=short_window,
        long_window=long_window,
        rsi_period=rsi_period,
        initial_capital=initial_capital,
        csv_data=csv_text,
    )
    strat = _resolve_strategy(req)
    engine = BacktestEngine(
        strategy=strat,
        initial_capital=req.initial_capital or settings.INITIAL_CAPITAL,
    )
    try:
        result = engine.run_from_csv(csv_text, symbol)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result.to_dict()


@app.post("/trade")
def execute_trade(req: TradeRequest, db: Session = Depends(get_db)):
    """Execute a single trade through the paper broker with risk checks."""
    side = req.side.upper()
    if side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")

    positions = broker.get_positions()
    current_exposure = sum(p.current_price * p.quantity for p in positions)

    if side == "BUY":
        assessment = risk_mgr.assess_trade(
            price=req.price,
            side=side,
            current_exposure=current_exposure,
            open_position_count=len(positions),
        )
        if not assessment.approved:
            raise HTTPException(status_code=400, detail=assessment.reason)
        qty = req.quantity if req.quantity else assessment.position_size
        order = broker.place_order(req.symbol, side, qty, req.price, assessment.stop_loss_price)
    else:
        existing = [p for p in positions if p.symbol == req.symbol]
        if not existing:
            raise HTTPException(status_code=400, detail=f"No open position for {req.symbol}")
        order = broker.close_position(req.symbol, req.price)

    if order.status == "FILLED":
        pnl = 0.0
        if side == "SELL":
            for p in positions:
                if p.symbol == req.symbol:
                    pnl = (order.price - p.entry_price) * order.quantity
                    break
        trade = Trade(
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=order.price,
            commission=order.commission,
            pnl=round(pnl, 2),
            status=order.status,
            strategy="manual",
        )
        db.add(trade)
        db.commit()
        risk_mgr.update_capital(broker.get_balance())

    return {
        "order_id": order.order_id,
        "symbol": order.symbol,
        "side": order.side,
        "quantity": order.quantity,
        "price": order.price,
        "status": order.status,
        "commission": order.commission,
        "message": order.message,
    }


@app.get("/positions")
def get_positions(db: Session = Depends(get_db)):
    """Return all open positions from the paper broker."""
    positions = broker.get_positions()
    return {
        "positions": [
            {
                "symbol": p.symbol,
                "side": p.side,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "current_price": p.current_price,
                "unrealized_pnl": p.unrealized_pnl,
                "stop_loss": p.stop_loss,
            }
            for p in positions
        ]
    }


@app.get("/performance")
def get_performance():
    """Return real-time portfolio performance metrics."""
    portfolio_value = broker.get_portfolio_value()
    cash = broker.get_balance()
    positions = broker.get_positions()
    position_value = sum(p.current_price * p.quantity for p in positions)
    total_return = (portfolio_value - settings.INITIAL_CAPITAL) / settings.INITIAL_CAPITAL

    return {
        "portfolio_value": round(portfolio_value, 2),
        "cash": round(cash, 2),
        "position_value": round(position_value, 2),
        "initial_capital": settings.INITIAL_CAPITAL,
        "total_return_pct": round(total_return, 6),
        "open_positions": len(positions),
    }


@app.get("/trades")
def get_trades(
    limit: int = Query(50, ge=1, le=500),
    symbol: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return historical trades from the database."""
    query = db.query(Trade).order_by(Trade.created_at.desc())
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    trades = query.limit(limit).all()
    return {"trades": [t.to_dict() for t in trades]}


@app.get("/balance")
def get_balance():
    """Return current cash balance and portfolio value."""
    return {
        "cash": broker.get_balance(),
        "portfolio_value": broker.get_portfolio_value(),
        "initial_capital": settings.INITIAL_CAPITAL,
    }


@app.post("/broker/reset")
def reset_broker(db: Session = Depends(get_db)):
    """Reset the paper broker to initial state and clear positions."""
    broker.reset()
    risk_mgr.update_capital(settings.INITIAL_CAPITAL)
    db.query(Position).delete()
    db.commit()
    return {"message": "Broker reset to initial state", "balance": broker.get_balance()}


@app.post("/price/update")
def update_price(symbol: str, price: float):
    """Update the current market price for position mark-to-market."""
    broker.update_price(symbol, price)
    return {"symbol": symbol, "price": price, "portfolio_value": broker.get_portfolio_value()}


def _resolve_strategy(req: BacktestRequest):
    """Instantiate the correct strategy from the request parameters."""
    if req.strategy == "ma_crossover":
        return MovingAverageCrossover(
            short_window=req.short_window,
            long_window=req.long_window,
        )
    elif req.strategy == "rsi_mean_reversion":
        return RSIMeanReversion(
            period=req.rsi_period or 14,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown strategy: {req.strategy}. Available: ma_crossover, rsi_mean_reversion",
        )


def main():
    """Launch the server via uvicorn."""
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
