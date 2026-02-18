package com.algo.service.broker;

import com.algo.dto.BrokerPositionResponse;
import com.algo.model.Order;

import java.util.List;

public interface BrokerService {
    
    /**
     * Place order to broker
     * @return Broker order ID
     */
    String placeOrder(Order order);
    
    /**
     * Cancel order at broker
     */
    void cancelOrder(String brokerOrderId);
    
    /**
     * Get order status from broker
     */
    OrderStatusResponse getOrderStatus(String brokerOrderId);
    
    /**
     * Get current market price
     */
    double getCurrentPrice(String symbol);
    
    /**
     * Get broker account balance
     */
    double getAccountBalance();
    
    /**
     * Check if broker is connected
     */
    boolean isConnected();
    
    /**
     * Get all open positions from broker
     */
    List<BrokerPositionResponse> getPositions();
    
    /**
     * Square off all positions - EMERGENCY USE ONLY
     */
    void squareOffAll();
    
    /**
     * Cancel all pending orders - EMERGENCY USE ONLY
     */
    void cancelAllOrders();
}
