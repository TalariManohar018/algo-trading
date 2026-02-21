package com.algo.service.engine;

import com.algo.enums.OrderStatus;
import com.algo.model.Order;
import com.algo.model.Position;
import com.algo.repository.OrderRepository;
import com.algo.repository.PositionRepository;
import com.algo.service.AuditService;
import com.algo.service.broker.BrokerService;
import com.algo.service.broker.OrderStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Reconciles DB order state against the broker every 30 seconds.
 *
 * <p>Handles:
 * <ul>
 *   <li>Partial fills (≥75% accepted, remainder cancels)</li>
 *   <li>Stale orders (PLACED >10 min → auto-cancel)</li>
 *   <li>Status mismatches (DB PLACED but broker FILLED/REJECTED)</li>
 *   <li>DB update with broker fill quantity and price</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderReconciliationService {

    private static final double PARTIAL_FILL_ACCEPT_THRESHOLD = 0.75;
    private static final long STALE_ORDER_MINUTES = 10;

    private final OrderRepository orderRepository;
    private final PositionRepository positionRepository;
    private final BrokerService brokerService;
    private final AuditService auditService;

    /**
     * Main reconciliation job — runs every 30 seconds during market hours.
     */
    @Scheduled(fixedDelayString = "${trading.reconciliation.interval-ms:30000}")
    @Transactional
    public void reconcile() {
        List<Order> pendingOrders = orderRepository
                .findByStatusIn(List.of(OrderStatus.PLACED, OrderStatus.PARTIALLY_FILLED, OrderStatus.PENDING));

        if (pendingOrders.isEmpty()) return;

        log.debug("[RECONCILE] Checking {} non-terminal orders", pendingOrders.size());

        for (Order order : pendingOrders) {
            try {
                reconcileOrder(order);
            } catch (Exception e) {
                log.error("[RECONCILE] Error reconciling order {}: {}", order.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public void reconcileOrder(Order order) {
        // Stale order check: PLACED > STALE_ORDER_MINUTES minutes ago
        if (order.getStatus() == OrderStatus.PLACED || order.getStatus() == OrderStatus.PENDING) {
            LocalDateTime threshold = LocalDateTime.now().minusMinutes(STALE_ORDER_MINUTES);
            if (order.getPlacedAt() != null && order.getPlacedAt().isBefore(threshold)) {
                cancelStaleOrder(order, "Stale: placed " + STALE_ORDER_MINUTES + "+ minutes ago");
                return;
            }
        }

        // No broker order ID — cannot reconcile
        if (order.getBrokerOrderId() == null || order.getBrokerOrderId().isBlank()) {
            log.warn("[RECONCILE] Order {} has no brokerOrderId — marking REJECTED", order.getId());
            order.setStatus(OrderStatus.REJECTED);
            order.setRejectedReason("No brokerOrderId assigned");
            order.setLastReconciledAt(LocalDateTime.now());
            orderRepository.save(order);
            return;
        }

        OrderStatusResponse brokerStatus = brokerService.getOrderStatus(order.getBrokerOrderId());
        if (brokerStatus == null) {
            log.warn("[RECONCILE] Null status from broker for order {}", order.getId());
            return;
        }

        order.setLastReconciledAt(LocalDateTime.now());

        switch (brokerStatus.getStatus()) {

            case FILLED -> handleFilled(order, brokerStatus);

            case PARTIALLY_FILLED -> handlePartialFill(order, brokerStatus);

            case REJECTED -> {
                if (order.getStatus() != OrderStatus.REJECTED) {
                    log.warn("[RECONCILE] Order {} is REJECTED by broker: {}",
                            order.getId(), brokerStatus.getMessage());
                    order.setStatus(OrderStatus.REJECTED);
                    order.setRejectedReason("Broker: " + brokerStatus.getMessage());
                    orderRepository.save(order);
                    auditService.logWarning(order.getUserId(), "ORDER_RECONCILE",
                            "Reconcile: REJECTED by broker — " + brokerStatus.getMessage(),
                            Map.of("orderId", order.getId()));
                }
            }

            case PLACED, PENDING -> {
                // Still waiting — update note
                order.setReconciliationNotes("Broker still pending as of " + LocalDateTime.now());
                orderRepository.save(order);
            }

            default -> log.debug("[RECONCILE] Order {} status unchanged: {}", order.getId(), brokerStatus.getStatus());
        }
    }

    private void handleFilled(Order order, OrderStatusResponse resp) {
        if (order.getStatus() == OrderStatus.FILLED) return; // Idempotent

        double filledPrice = resp.getFilledPrice();
        int filledQty = order.getQuantity(); // broker says fully filled

        order.setStatus(OrderStatus.FILLED);
        order.setFilledPrice(filledPrice);
        order.setFilledQuantity(filledQty);
        order.setFilledAt(LocalDateTime.now());
        orderRepository.save(order);

        // Sync position entry price if it was created with a placeholder
        positionRepository.findByUserIdAndStrategyIdAndStatus(
                order.getUserId(), order.getStrategyId(), com.algo.enums.PositionStatus.OPEN)
                .stream()
                .filter(p -> p.getSymbol().equals(order.getSymbol()))
                .findFirst()
                .ifPresent(position -> {
                    if (position.getEntryPrice() != filledPrice) {
                        position.setEntryPrice(filledPrice);
                        position.setCurrentPrice(filledPrice);
                        positionRepository.save(position);
                        log.info("[RECONCILE] Position {} entry price synced to ₹{}", position.getId(), filledPrice);
                    }
                });

        log.info("[RECONCILE] Order {} FILLED x{} @ ₹{}", order.getId(), filledQty, filledPrice);
        auditService.logInfo(order.getUserId(), "ORDER_RECONCILE",
                String.format("Reconciled FILLED: %s x%d @ ₹%.2f", order.getSymbol(), filledQty, filledPrice),
                Map.of("orderId", order.getId()));
    }

    private void handlePartialFill(Order order, OrderStatusResponse resp) {
        int filled = resp.getFilledQuantity() != null ? resp.getFilledQuantity() : 0;
        int total = order.getQuantity();
        double fillRatio = (double) filled / total;

        log.info("[RECONCILE] Partial fill: order {} {}/{} ({}%)",
                order.getId(), filled, total, String.format("%.1f", fillRatio * 100));

        if (fillRatio >= PARTIAL_FILL_ACCEPT_THRESHOLD) {
            // Accept the partial fill — cancel remainder
            log.info("[RECONCILE] Accepting partial fill ≥{}% for order {}",
                    (int) (PARTIAL_FILL_ACCEPT_THRESHOLD * 100), order.getId());

            try {
                brokerService.cancelOrder(order.getBrokerOrderId());
            } catch (Exception e) {
                log.warn("[RECONCILE] Could not cancel remainder for order {}: {}", order.getId(), e.getMessage());
            }

            order.setStatus(OrderStatus.FILLED);
            order.setFilledQuantity(filled);
            order.setFilledPrice(resp.getFilledPrice());
            order.setFilledAt(LocalDateTime.now());
            order.setReconciliationNotes(
                    String.format("Partial fill accepted: %d/%d (%.1f%%)", filled, total, fillRatio * 100));
            orderRepository.save(order);

            // Update position quantity to match actually filled
            positionRepository.findByUserIdAndStrategyIdAndStatus(
                    order.getUserId(), order.getStrategyId(), com.algo.enums.PositionStatus.OPEN)
                    .stream()
                    .filter(p -> p.getSymbol().equals(order.getSymbol()))
                    .findFirst()
                    .ifPresent(p -> { p.setQuantity(filled); positionRepository.save(p); });

            auditService.logInfo(order.getUserId(), "ORDER_RECONCILE",
                    String.format("Partial fill accepted: %s %d/%d @ ₹%.2f",
                            order.getSymbol(), filled, total, resp.getFilledPrice()),
                    Map.of("orderId", order.getId()));

        } else {
            // < 75% — keep waiting; update recorded qty
            order.setStatus(OrderStatus.PARTIALLY_FILLED);
            order.setFilledQuantity(filled);
            order.setReconciliationNotes(
                    String.format("Partial fill <%.0f%%: %d/%d — waiting", PARTIAL_FILL_ACCEPT_THRESHOLD * 100, filled, total));
            orderRepository.save(order);
        }
    }

    private void cancelStaleOrder(Order order, String reason) {
        log.warn("[RECONCILE] Cancelling stale order {}: {}", order.getId(), reason);
        try {
            if (order.getBrokerOrderId() != null) {
                brokerService.cancelOrder(order.getBrokerOrderId());
            }
        } catch (Exception e) {
            log.warn("[RECONCILE] Broker cancel failed for stale order {}: {}", order.getId(), e.getMessage());
        }

        order.setStatus(OrderStatus.REJECTED);
        order.setCancelledAt(LocalDateTime.now());
        order.setRejectedReason(reason);
        order.setLastReconciledAt(LocalDateTime.now());
        orderRepository.save(order);

        auditService.logWarning(order.getUserId(), "ORDER_RECONCILE",
                "Stale order cancelled: " + reason,
                Map.of("orderId", order.getId()));
    }
}
