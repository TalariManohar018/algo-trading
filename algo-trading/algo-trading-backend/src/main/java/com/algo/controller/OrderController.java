package com.algo.controller;

import com.algo.model.Order;
import com.algo.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    
    private final OrderService orderService;
    
    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody Order order, Authentication authentication) {
        return ResponseEntity.ok(orderService.createOrder(order, authentication));
    }
    
    @PostMapping("/{id}/place")
    public ResponseEntity<Order> placeOrder(@PathVariable Long id, @RequestParam Double currentPrice) {
        return ResponseEntity.ok(orderService.placeOrder(id, currentPrice));
    }
    
    @PostMapping("/{id}/fill")
    public ResponseEntity<Order> fillOrder(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.fillOrder(id));
    }
    
    @GetMapping
    public ResponseEntity<List<Order>> getUserOrders(Authentication authentication) {
        return ResponseEntity.ok(orderService.getUserOrders(authentication));
    }
    
    @GetMapping("/open")
    public ResponseEntity<List<Order>> getOpenOrders(Authentication authentication) {
        return ResponseEntity.ok(orderService.getOpenOrders(authentication));
    }
}
