package com.algo.repository;

import com.algo.enums.OrderStatus;
import com.algo.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Order> findByUserIdAndStatus(Long userId, OrderStatus status);
    List<Order> findByStrategyId(Long strategyId);
    List<Order> findByStatusIn(List<OrderStatus> statuses);
    List<Order> findByUserIdAndStatusIn(Long userId, List<OrderStatus> statuses);
    boolean existsByDeduplicationKey(String deduplicationKey);
    
    // Recovery queries
    Optional<Order> findByBrokerOrderId(String brokerOrderId);
    List<Order> findByStatusInOrderByCreatedAtAsc(List<OrderStatus> statuses);
}
