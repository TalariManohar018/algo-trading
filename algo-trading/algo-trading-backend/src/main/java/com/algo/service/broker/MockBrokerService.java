package com.algo.service.broker;

import com.algo.dto.BrokerPositionResponse;
import com.algo.enums.OrderStatus;
import com.algo.model.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Primary
@Slf4j
public class MockBrokerService implements BrokerService {
    
    private final Map<String, Double> marketPrices = new HashMap<>();
    private final Map<String, OrderStatusResponse> orderStatuses = new HashMap<>();
    private final List<String> pendingOrders = new ArrayList<>();
    private final Map<String, BrokerPositionResponse> positions = new HashMap<>();
    private final Random random = new Random();
    private boolean connected = true;
    
    public MockBrokerService() {
        // Initialize mock market prices
        marketPrices.put("RELIANCE", 2500.0);
        marketPrices.put("TCS", 3500.0);
        marketPrices.put("INFY", 1500.0);
        marketPrices.put("HDFCBANK", 1600.0);
        marketPrices.put("ICICIBANK", 900.0);
        marketPrices.put("SBIN", 600.0);
        marketPrices.put("WIPRO", 450.0);
        marketPrices.put("ITC", 400.0);
        marketPrices.put("BHARTIARTL", 850.0);
        marketPrices.put("AXISBANK", 1000.0);
    }
    
    @Override
    public String placeOrder(Order order) {
        String brokerOrderId = "MOCK_" + UUID.randomUUID().toString().substring(0, 8);
        
        log.info("[MOCK BROKER] Placing order: {} {} {} @ ₹{}", 
                order.getSide(), order.getQuantity(), order.getSymbol(), order.getLimitPrice());
        
        // Simulate 5% rejection rate
        if (random.nextDouble() < 0.05) {
            OrderStatusResponse response = OrderStatusResponse.builder()
                    .brokerOrderId(brokerOrderId)
                    .status(OrderStatus.REJECTED)
                    .message("Mock rejection: Insufficient funds or circuit limit")
                    .build();
            
            orderStatuses.put(brokerOrderId, response);
            log.warn("[MOCK BROKER] Order {} rejected", brokerOrderId);
            return brokerOrderId;
        }
        
        // Simulate immediate fill for market orders
        double currentPrice = getCurrentPrice(order.getSymbol());
        double slippage = currentPrice * (random.nextDouble() * 0.002); // 0-0.2% slippage
        double filledPrice = order.getSide().name().equals("BUY") 
                ? currentPrice + slippage 
                : currentPrice - slippage;
        
        OrderStatusResponse response = OrderStatusResponse.builder()
                .brokerOrderId(brokerOrderId)
                .status(OrderStatus.FILLED)
                .filledPrice(filledPrice)
                .filledQuantity(order.getQuantity())
                .message("Filled by mock broker")
                .build();
        
        orderStatuses.put(brokerOrderId, response);
        
        // Update mock positions
        updateMockPosition(order.getSymbol(), order.getSide().name(), order.getQuantity(), filledPrice);
        
        log.info("[MOCK BROKER] Order {} filled at ₹{}", brokerOrderId, filledPrice);
        
        return brokerOrderId;
    }
    
    private void updateMockPosition(String symbol, String side, int quantity, double price) {
        BrokerPositionResponse position = positions.get(symbol);
        
        if (position == null) {
            position = BrokerPositionResponse.builder()
                    .symbol(symbol)
                    .quantity(side.equals("BUY") ? quantity : -quantity)
                    .averagePrice(price)
                    .lastPrice(price)
                    .pnl(0.0)
                    .product("MIS")
                    .build();
            positions.put(symbol, position);
        } else {
            int newQuantity = position.getQuantity() + (side.equals("BUY") ? quantity : -quantity);
            
            if (newQuantity == 0) {
                // Position closed
                positions.remove(symbol);
            } else {
                // Update position
                double totalCost = position.getAveragePrice() * Math.abs(position.getQuantity()) + price * quantity;
                double avgPrice = totalCost / (Math.abs(position.getQuantity()) + quantity);
                position.setQuantity(newQuantity);
                position.setAveragePrice(avgPrice);
                position.setLastPrice(price);
            }
        }
    }
    
    @Override
    public void cancelOrder(String brokerOrderId) {
        OrderStatusResponse status = orderStatuses.get(brokerOrderId);
        if (status != null && status.getStatus() == OrderStatus.PLACED) {
            status.setStatus(OrderStatus.CLOSED);
            status.setMessage("Cancelled by user");
            pendingOrders.remove(brokerOrderId);
            log.info("[MOCK BROKER] Order {} cancelled", brokerOrderId);
        }
    }
    
    @Override
    public OrderStatusResponse getOrderStatus(String brokerOrderId) {
        return orderStatuses.getOrDefault(brokerOrderId, 
                OrderStatusResponse.builder()
                        .brokerOrderId(brokerOrderId)
                        .status(OrderStatus.REJECTED)
                        .message("Order not found")
                        .build());
    }
    
    @Override
    public double getCurrentPrice(String symbol) {
        // Simulate price movement (±1%)
        double basePrice = marketPrices.getOrDefault(symbol, 1000.0);
        double movement = basePrice * (random.nextDouble() * 0.02 - 0.01);
        double currentPrice = basePrice + movement;
        
        // Update stored price
        marketPrices.put(symbol, currentPrice);
        
        return currentPrice;
    }
    
    @Override
    public double getAccountBalance() {
        // Return mock balance
        return 100000.0;
    }
    
    @Override
    public boolean isConnected() {
        return connected;
    }
    
    @Override
    public List<BrokerPositionResponse> getPositions() {
        // Update last prices for all positions
        for (BrokerPositionResponse position : positions.values()) {
            double lastPrice = getCurrentPrice(position.getSymbol());
            position.setLastPrice(lastPrice);
            double pnl = (lastPrice - position.getAveragePrice()) * position.getQuantity();
            position.setPnl(pnl);
        }
        return new ArrayList<>(positions.values());
    }
    
    @Override
    public void squareOffAll() {
        log.warn("[MOCK BROKER] SQUARE OFF ALL positions - {} positions", positions.size());
        
        for (BrokerPositionResponse position : new ArrayList<>(positions.values())) {
            String side = position.getQuantity() > 0 ? "SELL" : "BUY";
            int qty = Math.abs(position.getQuantity());
            double price = getCurrentPrice(position.getSymbol());
            
            log.info("[MOCK BROKER] Squaring off {} {} {}", qty, position.getSymbol(), side);
            updateMockPosition(position.getSymbol(), side, qty, price);
        }
        
        positions.clear();
        log.info("[MOCK BROKER] All positions squared off");
    }
    
    @Override
    public void cancelAllOrders() {
        log.warn("[MOCK BROKER] CANCEL ALL orders - {} pending orders", pendingOrders.size());
        
        for (String orderId : new ArrayList<>(pendingOrders)) {
            cancelOrder(orderId);
        }
        
        pendingOrders.clear();
        log.info("[MOCK BROKER] All pending orders cancelled");
    }
    
    public void setConnected(boolean connected) {
        this.connected = connected;
    }
}
