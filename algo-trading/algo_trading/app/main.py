# app/main.py
from __future__ import annotations

import io
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backtesting.engine import BacktestEngine
from app.broker.paper_broker import PaperBroker
from app.config import settings
from app.database import get_db, init_db
from app.models.trade import Position, Trade
from app.risk.manager import RiskManager
from app.strategies.moving_average import MovingAverageCrossover, RSIMeanReversion

# ── Singletons ──────────────────────────────────────────────────────────────
broker = PaperBroker()
risk_mgr = RiskManager()

available_strategies = {
    "ma_crossover": MovingAverageCrossover(),
    "rsi_mean_reversion": RSIMeanReversion(),
}


# ── App lifecycle ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Algo Trading Engine",
    version="2.0.0",
    description="Production algorithmic trading backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ───────────────────────────────────────────────────────
class BacktestRequest(BaseModel):
    strategy: str = Field("ma_crossover", description="ma_crossover | rsi_mean_reversion")
    symbol: str = Field("AAPL")
    short_window: Optional[int] = None
    long_window: Optional[int] = None
    rsi_period: Optional[int] = None
    initial_capital: Optional[float] = None
    csv_data: Optional[str] = None


class TradeRequest(BaseModel):
    symbol: str
    side: str
    quantity: Optional[float] = None
    price: float


class PriceUpdate(BaseModel):
    symbol: str
    price: float


# ── Helpers ─────────────────────────────────────────────────────────────────
def _make_strategy(req: BacktestRequest):
    if req.strategy == "ma_crossover":
        return MovingAverageCrossover(short_window=req.short_window, long_window=req.long_window)
    if req.strategy == "rsi_mean_reversion":
        return RSIMeanReversion(period=req.rsi_period or 14)
    raise HTTPException(400, f"Unknown strategy: {req.strategy}. Options: ma_crossover, rsi_mean_reversion")


# ── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/strategies")
def list_strategies():
    return {
        "strategies": [
            {"key": "ma_crossover", "name": available_strategies["ma_crossover"].name, "params": {"short_window": settings.SHORT_WINDOW, "long_window": settings.LONG_WINDOW}},
            {"key": "rsi_mean_reversion", "name": available_strategies["rsi_mean_reversion"].name, "params": {"period": 14, "oversold": 30, "overbought": 70}},
        ]
    }


@app.post("/backtest")
def run_backtest(req: BacktestRequest):
    if not req.csv_data:
        raise HTTPException(400, "csv_data is required (OHLCV CSV string)")
    strat = _make_strategy(req)
    engine = BacktestEngine(strategy=strat, initial_capital=req.initial_capital or settings.INITIAL_CAPITAL)
    try:
        result = engine.run_from_csv(req.csv_data, req.symbol)
    except Exception as exc:
        raise HTTPException(422, str(exc))
    return result.to_dict()


@app.post("/backtest/upload")
async def backtest_upload(
    file: UploadFile = File(...),
    strategy: str = Query("ma_crossover"),
    symbol: str = Query("AAPL"),
    short_window: Optional[int] = Query(None),
    long_window: Optional[int] = Query(None),
    rsi_period: Optional[int] = Query(None),
    initial_capital: Optional[float] = Query(None),
):
    content = (await file.read()).decode("utf-8")
    req = BacktestRequest(strategy=strategy, symbol=symbol, short_window=short_window, long_window=long_window, rsi_period=rsi_period, initial_capital=initial_capital, csv_data=content)
    return run_backtest(req)


@app.post("/trade")
def execute_trade(req: TradeRequest, db: Session = Depends(get_db)):
    side = req.side.upper()
    if side not in ("BUY", "SELL"):
        raise HTTPException(400, "side must be BUY or SELL")

    positions = broker.get_positions()
    exposure = sum(p.current_price * p.quantity for p in positions)

    if side == "BUY":
        assessment = risk_mgr.assess_trade(req.price, side, exposure, len(positions))
        if not assessment.approved:
            raise HTTPException(400, assessment.reason)
        qty = req.quantity or assessment.position_size
        order = broker.place_order(req.symbol, side, qty, req.price, assessment.stop_loss_price)
    else:
        has = [p for p in positions if p.symbol == req.symbol]
        if not has:
            raise HTTPException(400, f"No open position for {req.symbol}")
        order = broker.close_position(req.symbol, req.price)

    if order.status == "FILLED":
        pnl = 0.0
        if side == "SELL":
            for p in positions:
                if p.symbol == req.symbol:
                    pnl = (order.price - p.entry_price) * order.quantity
                    break
        db.add(Trade(symbol=order.symbol, side=order.side, quantity=order.quantity, price=order.price, commission=order.commission, pnl=round(pnl, 2), status=order.status, strategy="manual"))
        db.commit()
        risk_mgr.update_capital(broker.get_balance())

    return {"order_id": order.order_id, "symbol": order.symbol, "side": order.side, "quantity": order.quantity, "price": order.price, "status": order.status, "commission": order.commission, "message": order.message}


@app.get("/positions")
def get_positions():
    return {"positions": [{"symbol": p.symbol, "side": p.side, "quantity": p.quantity, "entry_price": p.entry_price, "current_price": p.current_price, "unrealized_pnl": p.unrealized_pnl, "stop_loss": p.stop_loss} for p in broker.get_positions()]}


@app.get("/performance")
def get_performance():
    pv = broker.get_portfolio_value()
    cash = broker.get_balance()
    positions = broker.get_positions()
    pos_val = sum(p.current_price * p.quantity for p in positions)
    ret = (pv - settings.INITIAL_CAPITAL) / settings.INITIAL_CAPITAL
    return {"portfolio_value": round(pv, 2), "cash": round(cash, 2), "position_value": round(pos_val, 2), "initial_capital": settings.INITIAL_CAPITAL, "total_return_pct": round(ret, 6), "open_positions": len(positions)}


@app.get("/trades")
def get_trades(limit: int = Query(50, ge=1, le=500), symbol: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Trade).order_by(Trade.created_at.desc())
    if symbol:
        q = q.filter(Trade.symbol == symbol)
    return {"trades": [t.to_dict() for t in q.limit(limit).all()]}


@app.get("/balance")
def get_balance():
    return {"cash": broker.get_balance(), "portfolio_value": broker.get_portfolio_value(), "initial_capital": settings.INITIAL_CAPITAL}


@app.post("/broker/reset")
def reset_broker(db: Session = Depends(get_db)):
    broker.reset()
    risk_mgr.update_capital(settings.INITIAL_CAPITAL)
    db.query(Position).delete()
    db.commit()
    return {"message": "Broker reset", "balance": broker.get_balance()}


@app.post("/price/update")
def update_price(body: PriceUpdate):
    broker.update_price(body.symbol, body.price)
    return {"symbol": body.symbol, "price": body.price, "portfolio_value": broker.get_portfolio_value()}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
