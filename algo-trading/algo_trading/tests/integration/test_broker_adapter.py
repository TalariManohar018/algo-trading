"""
Integration tests for broker adapter functionality.

Tests the broker interface with mock adapters to ensure
order requests translate to expected broker payloads.
"""
import pytest
from typing import Optional

# Mock imports for testing without actual broker dependencies
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.broker.base import BaseBroker, OrderResult, PositionInfo
from app.broker.paper_broker import PaperBroker


class MockBrokerAdapter(BaseBroker):
    """
    Mock broker adapter for testing order translation logic.
    Simulates a real broker API without external dependencies.
    """
    
    def __init__(self, initial_balance: float = 100000.0):
        self.balance = initial_balance
        self.positions = {}
        self.order_history = []
        self.last_order_payload = None
    
    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None
    ) -> OrderResult:
        """
        Mock order placement - captures payload for assertion.
        """
        # Capture the order payload structure
        self.last_order_payload = {
            "symbol": symbol,
            "side": side.upper(),
            "quantity": quantity,
            "price": price,
            "order_type": "LIMIT",
            "stop_loss": stop_loss,
        }
        
        order_id = f"MOCK_{len(self.order_history) + 1}"
        cost = quantity * price
        commission = cost * 0.001  # 0.1% commission
        
        # Simple order execution logic
        if side.upper() == "BUY":
            if cost + commission > self.balance:
                return OrderResult(
                    order_id=order_id,
                    symbol=symbol,
                    side=side,
                    quantity=0,
                    price=price,
                    status="REJECTED",
                    commission=0,
                    message="Insufficient balance"
                )
            
            self.balance -= (cost + commission)
            if symbol in self.positions:
                self.positions[symbol]["quantity"] += quantity
            else:
                self.positions[symbol] = {
                    "quantity": quantity,
                    "entry_price": price,
                    "current_price": price,
                }
            
            result = OrderResult(
                order_id=order_id,
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                status="FILLED",
                commission=commission,
                message="Order filled successfully"
            )
        else:  # SELL
            if symbol not in self.positions:
                return OrderResult(
                    order_id=order_id,
                    symbol=symbol,
                    side=side,
                    quantity=0,
                    price=price,
                    status="REJECTED",
                    commission=0,
                    message=f"No position found for {symbol}"
                )
            
            position = self.positions[symbol]
            if quantity > position["quantity"]:
                return OrderResult(
                    order_id=order_id,
                    symbol=symbol,
                    side=side,
                    quantity=0,
                    price=price,
                    status="REJECTED",
                    commission=0,
                    message="Insufficient quantity"
                )
            
            self.balance += (quantity * price - commission)
            position["quantity"] -= quantity
            
            if position["quantity"] < 0.001:
                del self.positions[symbol]
            
            result = OrderResult(
                order_id=order_id,
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                status="FILLED",
                commission=commission,
                message="Order filled successfully"
            )
        
        self.order_history.append(result)
        return result
    
    def get_positions(self) -> list[PositionInfo]:
        """Get all open positions."""
        positions = []
        for symbol, pos in self.positions.items():
            pnl = (pos["current_price"] - pos["entry_price"]) * pos["quantity"]
            positions.append(
                PositionInfo(
                    symbol=symbol,
                    side="BUY",
                    quantity=pos["quantity"],
                    entry_price=pos["entry_price"],
                    current_price=pos["current_price"],
                    unrealized_pnl=pnl,
                    stop_loss=None
                )
            )
        return positions
    
    def close_position(self, symbol: str, price: float) -> OrderResult:
        """Close an open position."""
        if symbol not in self.positions:
            order_id = f"MOCK_{len(self.order_history) + 1}"
            return OrderResult(
                order_id=order_id,
                symbol=symbol,
                side="SELL",
                quantity=0,
                price=price,
                status="REJECTED",
                commission=0,
                message=f"No position found for {symbol}"
            )
        
        quantity = self.positions[symbol]["quantity"]
        return self.place_order(symbol, "SELL", quantity, price)
    
    def get_balance(self) -> float:
        """Get current cash balance."""
        return self.balance
    
    def get_portfolio_value(self) -> float:
        """Get total portfolio value (cash + positions)."""
        position_value = sum(
            pos["quantity"] * pos["current_price"]
            for pos in self.positions.values()
        )
        return self.balance + position_value


# ============================================================
# TEST CASES
# ============================================================

class TestBrokerAdapter:
    """Test suite for broker adapter integration."""
    
    def test_mock_broker_initialization(self):
        """Test that mock broker initializes correctly."""
        broker = MockBrokerAdapter(initial_balance=50000.0)
        assert broker.get_balance() == 50000.0
        assert len(broker.get_positions()) == 0
    
    def test_order_payload_structure(self):
        """Test that order requests translate to expected payload structure."""
        broker = MockBrokerAdapter()
        
        # Place a buy order
        result = broker.place_order(
            symbol="RELIANCE",
            side="BUY",
            quantity=10,
            price=2500.0,
            stop_loss=2400.0
        )
        
        # Assert payload structure
        assert broker.last_order_payload is not None
        assert broker.last_order_payload["symbol"] == "RELIANCE"
        assert broker.last_order_payload["side"] == "BUY"
        assert broker.last_order_payload["quantity"] == 10
        assert broker.last_order_payload["price"] == 2500.0
        assert broker.last_order_payload["order_type"] == "LIMIT"
        assert broker.last_order_payload["stop_loss"] == 2400.0
        
        # Assert order result
        assert result.status == "FILLED"
        assert result.symbol == "RELIANCE"
        assert result.quantity == 10
    
    def test_buy_order_execution(self):
        """Test buy order execution and balance updates."""
        broker = MockBrokerAdapter(initial_balance=100000.0)
        
        result = broker.place_order("INFY", "BUY", 50, 1500.0)
        
        assert result.status == "FILLED"
        assert result.quantity == 50
        
        # Check balance deduction (cost + commission)
        cost = 50 * 1500.0
        commission = cost * 0.001
        expected_balance = 100000.0 - cost - commission
        assert abs(broker.get_balance() - expected_balance) < 0.01
        
        # Check position created
        positions = broker.get_positions()
        assert len(positions) == 1
        assert positions[0].symbol == "INFY"
        assert positions[0].quantity == 50
    
    def test_sell_order_execution(self):
        """Test sell order execution and position closure."""
        broker = MockBrokerAdapter(initial_balance=100000.0)
        
        # First buy
        broker.place_order("TCS", "BUY", 30, 3500.0)
        
        # Then sell
        result = broker.place_order("TCS", "SELL", 30, 3600.0)
        
        assert result.status == "FILLED"
        assert result.quantity == 30
        
        # Position should be closed
        positions = broker.get_positions()
        assert len(positions) == 0
    
    def test_insufficient_balance_rejection(self):
        """Test that orders are rejected with insufficient balance."""
        broker = MockBrokerAdapter(initial_balance=1000.0)
        
        result = broker.place_order("RELIANCE", "BUY", 100, 2500.0)
        
        assert result.status == "REJECTED"
        assert result.quantity == 0
        assert "Insufficient balance" in result.message
    
    def test_sell_without_position_rejection(self):
        """Test that sell orders are rejected without open position."""
        broker = MockBrokerAdapter()
        
        result = broker.place_order("HDFC", "SELL", 10, 1600.0)
        
        assert result.status == "REJECTED"
        assert "No position found" in result.message
    
    def test_close_position_functionality(self):
        """Test close_position method."""
        broker = MockBrokerAdapter(initial_balance=100000.0)
        
        # Open position
        broker.place_order("SBIN", "BUY", 100, 500.0)
        
        # Close position
        result = broker.close_position("SBIN", 520.0)
        
        assert result.status == "FILLED"
        assert result.side == "SELL"
        assert result.quantity == 100
        
        # Position should be closed
        assert len(broker.get_positions()) == 0
    
    def test_portfolio_value_calculation(self):
        """Test portfolio value includes cash and positions."""
        broker = MockBrokerAdapter(initial_balance=100000.0)
        
        # Buy some stocks
        broker.place_order("INFY", "BUY", 50, 1500.0)
        broker.place_order("TCS", "BUY", 30, 3500.0)
        
        portfolio_value = broker.get_portfolio_value()
        
        # Should be close to initial balance (minus commissions)
        assert portfolio_value < 100000.0
        assert portfolio_value > 99000.0  # Allow for commissions


class TestPaperBroker:
    """Test suite for PaperBroker implementation."""
    
    def test_paper_broker_initialization(self):
        """Test PaperBroker initializes with correct defaults."""
        broker = PaperBroker(initial_capital=50000.0, commission_pct=0.001, slippage_pct=0.0005)
        
        assert broker.initial_capital == 50000.0
        assert broker.cash == 50000.0
        assert broker.commission_pct == 0.001
        assert broker.slippage_pct == 0.0005
    
    def test_paper_broker_buy_order(self):
        """Test PaperBroker buy order with slippage."""
        broker = PaperBroker(initial_capital=100000.0, commission_pct=0.001, slippage_pct=0.001)
        
        result = broker.place_order("RELIANCE", "BUY", 10, 2500.0)
        
        assert result.status == "FILLED"
        assert result.quantity == 10
        # Price should include slippage
        assert result.price > 2500.0
        assert result.commission > 0
    
    def test_paper_broker_positions_tracking(self):
        """Test that PaperBroker tracks positions correctly."""
        broker = PaperBroker(initial_capital=100000.0)
        
        broker.place_order("INFY", "BUY", 50, 1500.0)
        broker.place_order("TCS", "BUY", 30, 3500.0)
        
        positions = broker.get_positions()
        
        assert len(positions) == 2
        symbols = {pos.symbol for pos in positions}
        assert "INFY" in symbols
        assert "TCS" in symbols
    
    def test_paper_broker_averaging(self):
        """Test that multiple buys average the entry price."""
        broker = PaperBroker(initial_capital=200000.0)
        
        broker.place_order("HDFC", "BUY", 10, 1600.0)
        broker.place_order("HDFC", "BUY", 10, 1800.0)
        
        positions = broker.get_positions()
        
        assert len(positions) == 1
        assert positions[0].quantity == 20
        # Entry price should be averaged (approximately 1700)
        assert 1600.0 < positions[0].entry_price < 1800.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
