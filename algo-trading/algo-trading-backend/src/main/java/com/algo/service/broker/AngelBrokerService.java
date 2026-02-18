package com.algo.service.broker;

import com.algo.dto.BrokerPositionResponse;
import com.algo.model.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * Angel One (AngelBroking) SmartAPI Integration (Placeholder)
 * 
 * To enable:
 * 1. Add SmartAPI SDK dependency to pom.xml
 * 2. Configure API key and client code in application.yml
 * 3. Implement authentication with TOTP
 * 4. Replace @Service with @Primary when ready
 */
@Service
@Slf4j
public class AngelBrokerService implements BrokerService {
    
    @Override
    public String placeOrder(Order order) {
        throw new UnsupportedOperationException("Angel One integration not configured. Use MockBrokerService for paper trading.");
    }
    
    @Override
    public void cancelOrder(String brokerOrderId) {
        throw new UnsupportedOperationException("Angel One integration not configured. Use MockBrokerService for paper trading.");
    }
    
    @Override
    public OrderStatusResponse getOrderStatus(String brokerOrderId) {
        throw new UnsupportedOperationException("Angel One integration not configured. Use MockBrokerService for paper trading.");
    }
    
    @Override
    public double getCurrentPrice(String symbol) {
        throw new UnsupportedOperationException("Angel One integration not configured. Use MockBrokerService for paper trading.");
    }
    
    @Override
    public double getAccountBalance() {
        throw new UnsupportedOperationException("Angel One integration not configured. Use MockBrokerService for paper trading.");
    }
    
    @Override
    public boolean isConnected() {
        return false;
    }
    
    @Override
    public List<BrokerPositionResponse> getPositions() {
        return Collections.emptyList();
    }
    
    @Override
    public void squareOffAll() {
        throw new UnsupportedOperationException("Angel One integration not configured.");
    }
    
    @Override
    public void cancelAllOrders() {
        throw new UnsupportedOperationException("Angel One integration not configured.");
    }
}
