package com.algo.service;

import com.algo.enums.OrderStatus;
import com.algo.model.Order;
import com.algo.model.User;
import com.algo.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {
    
    private final OrderRepository orderRepository;
    private final WalletService walletService;
    
    @Transactional
    public Order createOrder(Order order, Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        order.setUserId(user.getId());
        order.setStatus(OrderStatus.CREATED);
        order.setCreatedAt(LocalDateTime.now());
        return orderRepository.save(order);
    }
    
    @Transactional
    public Order placeOrder(Long orderId, Double currentPrice) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        
        // Simulate random rejection (5%)
        if (Math.random() < 0.05) {
            order.setStatus(OrderStatus.REJECTED);
            order.setRejectedReason("Insufficient margin or invalid price");
            return orderRepository.save(order);
        }
        
        order.setStatus(OrderStatus.PLACED);
        order.setPlacedPrice(currentPrice);
        order.setPlacedAt(LocalDateTime.now());
        return orderRepository.save(order);
    }
    
    @Transactional
    public Order fillOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        
        if (order.getStatus() != OrderStatus.PLACED) {
            throw new RuntimeException("Order must be PLACED before filling");
        }
        
        // Calculate slippage (0.1%)
        double basePrice = order.getPlacedPrice();
        double slippage = basePrice * 0.001;
        double filledPrice = order.getSide().name().equals("BUY") 
                ? basePrice + slippage 
                : basePrice - slippage;
        
        order.setStatus(OrderStatus.FILLED);
        order.setFilledPrice(filledPrice);
        order.setFilledAt(LocalDateTime.now());
        
        // Update wallet
        walletService.updateMarginOnOrderFilled(order.getUserId(), order);
        
        return orderRepository.save(order);
    }
    
    public List<Order> getUserOrders(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
    
    public List<Order> getOpenOrders(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return orderRepository.findByUserIdAndStatus(user.getId(), OrderStatus.PLACED);
    }
}
