package com.algo.service.engine;

import com.algo.dto.QueuedOrder;
import com.algo.enums.OrderSide;
import com.algo.enums.OrderStatus;
import com.algo.enums.OrderType;
import com.algo.model.Order;
import com.algo.repository.OrderRepository;
import com.algo.service.AuditService;
import com.algo.service.broker.BrokerService;
import com.algo.service.broker.OrderStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * Crash-recovery service that runs on application startup.
 * 
 * <p>Ensures no orders are lost or duplicated after a system crash/restart by:
 * <ol>
 *   <li>Pausing all strategy execution</li>
 *   <li>Loading incomplete orders from DB</li>
 *   <li>Reconciling with broker for orders that were already sent</li>
 *   <li>Re-enqueueing orders that were never sent</li>
 *   <li>Resuming trading only after successful reconciliation</li>
 * </ol>
 * 
 * <p>Safety guarantees:
 * <ul>
 *   <li>No duplicate execution (checks broker first if brokerOrderId exists)</li>
 *   <li>No order loss (re-enqueues unsent orders)</li>
 *   <li>Fail-safe (blocks trading if broker unavailable during recovery)</li>
 *   <li>Idempotent (can be re-run safely)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StartupRecoveryService {

    private final OrderRepository orderRepository;
    private final BrokerService brokerService;
    private final OrderExecutionQueue executionQueue;
    private final TradingEngineStateManager stateManager;
    private final AuditService auditService;

    @Value("${trading.recovery.enabled:true}")
    private boolean recoveryEnabled;

    @Value("${trading.recovery.max-retries:5}")
    private int maxRetries;

    @Value("${trading.recovery.initial-delay-ms:2000}")
    private long initialDelayMs;

    @Value("${trading.recovery.max-delay-ms:60000}")
    private long maxDelayMs;

    @Value("${trading.recovery.backoff-multiplier:2.0}")
    private double backoffMultiplier;

    /**
     * Runs automatically after Spring Boot application is fully started.
     * Uses ApplicationReadyEvent to ensure all beans are initialized.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void performStartupRecovery() {
        if (!recoveryEnabled) {
            log.info("[RECOVERY] Startup recovery disabled by config");
            stateManager.enableTrading();
            return;
        }

        log.info("╔═══════════════════════════════════════════════════════════════╗");
        log.info("║         STARTUP RECOVERY IN PROGRESS                          ║");
        log.info("║         Trading is PAUSED until reconciliation completes      ║");
        log.info("╚═══════════════════════════════════════════════════════════════╝");

        stateManager.pauseTrading("Startup recovery in progress");

        try {
            recoverOrders();
            log.info("[RECOVERY] ✅ Recovery completed successfully");
            stateManager.enableTrading();
        } catch (Exception e) {
            log.error("[RECOVERY] ❌ Recovery failed - trading remains PAUSED", e);
            auditService.logCritical(null, "RECOVERY_FAILED",
                    "Startup recovery failed: " + e.getMessage(), null);
            // Trading remains paused - manual intervention required
        }
    }

    /**
     * Main recovery logic
     */
    private void recoverOrders() {
        // Load all incomplete orders from DB
        List<OrderStatus> incompleteStatuses = Arrays.asList(
                OrderStatus.CREATED,
                OrderStatus.PENDING,
                OrderStatus.PLACED
        );

        List<Order> incompleteOrders = orderRepository.findByStatusIn(incompleteStatuses);

        if (incompleteOrders.isEmpty()) {
            log.info("[RECOVERY] No incomplete orders found - clean startup");
            return;
        }

        log.info("[RECOVERY] Found {} incomplete orders to recover", incompleteOrders.size());

        int reconciled = 0;
        int requeued = 0;
        int failed = 0;

        for (Order order : incompleteOrders) {
            try {
                if (order.getBrokerOrderId() != null) {
                    // Order was sent to broker - reconcile with broker
                    if (reconcileWithBroker(order)) {
                        reconciled++;
                    } else {
                        failed++;
                    }
                } else {
                    // Order was never sent - re-enqueue it
                    if (reEnqueueOrder(order)) {
                        requeued++;
                    } else {
                        failed++;
                    }
                }
            } catch (Exception e) {
                log.error("[RECOVERY] Failed to recover order {}: {}", order.getId(), e.getMessage());
                failed++;
            }
        }

        log.info("[RECOVERY] Summary: {} reconciled with broker, {} re-enqueued, {} failed",
                reconciled, requeued, failed);

        if (failed > 0) {
            throw new RuntimeException("Recovery incomplete: " + failed + " orders failed");
        }
    }

    /**
     * Reconcile order status with broker using exponential backoff retry.
     * Only called for orders that have brokerOrderId (were already sent to broker).
     */
    @Transactional
    protected boolean reconcileWithBroker(Order order) {
        log.info("[RECOVERY] Reconciling order {} with broker (brokerOrderId={})",
                order.getId(), order.getBrokerOrderId());

        long delay = initialDelayMs;
        Exception lastException = null;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check if broker is available
                if (!brokerService.isConnected()) {
                    throw new RuntimeException("Broker not connected");
                }

                // Fetch real order status from broker
                OrderStatusResponse brokerStatus = brokerService.getOrderStatus(order.getBrokerOrderId());

                // Update our DB with broker truth
                updateOrderFromBrokerStatus(order, brokerStatus);

                log.info("[RECOVERY] ✅ Successfully reconciled order {} - status now: {}",
                        order.getId(), order.getStatus());

                auditService.logInfo(order.getUserId(), "RECOVERY_RECONCILED",
                        String.format("Order %d reconciled with broker: %s",
                                order.getId(), order.getStatus()),
                        null);

                return true;

            } catch (Exception e) {
                lastException = e;
                log.warn("[RECOVERY] Attempt {}/{} failed for order {}: {}",
                        attempt, maxRetries, order.getId(), e.getMessage());

                if (attempt < maxRetries) {
                    try {
                        log.info("[RECOVERY] Waiting {}ms before retry...", delay);
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Recovery interrupted", ie);
                    }

                    // Exponential backoff with cap
                    delay = Math.min((long) (delay * backoffMultiplier), maxDelayMs);
                }
            }
        }

        // All retries failed - mark order as needing manual review
        log.error("[RECOVERY] ❌ Failed to reconcile order {} after {} attempts",
                order.getId(), maxRetries);

        order.setRejectedReason("Recovery failed: broker unavailable after " + maxRetries + " attempts. " +
                "Last error: " + (lastException != null ? lastException.getMessage() : "unknown"));
        orderRepository.save(order);

        auditService.logCritical(order.getUserId(), "RECOVERY_FAILED",
                String.format("Failed to reconcile order %d with broker - manual review required",
                        order.getId()),
                null);

        return false;
    }

    /**
     * Update order entity from broker response
     */
    @Transactional
    protected void updateOrderFromBrokerStatus(Order order, OrderStatusResponse brokerStatus) {
        OrderStatus status = brokerStatus.getStatus();
        
        switch (status) {
            case FILLED:
                order.setStatus(OrderStatus.FILLED);
                order.setFilledQuantity(brokerStatus.getFilledQuantity());
                order.setFilledPrice(brokerStatus.getFilledPrice());
                order.setFilledAt(LocalDateTime.now());
                break;

            case PARTIALLY_FILLED:
                order.setStatus(OrderStatus.PARTIALLY_FILLED);
                order.setFilledQuantity(brokerStatus.getFilledQuantity());
                order.setFilledPrice(brokerStatus.getFilledPrice());
                break;

            case REJECTED:
                order.setStatus(OrderStatus.REJECTED);
                order.setRejectedReason(brokerStatus.getMessage());
                break;

            case PLACED:
            case PENDING:
                order.setStatus(OrderStatus.PLACED);
                break;

            default:
                log.warn("[RECOVERY] Unknown broker status '{}' for order {} - keeping as PLACED",
                        status, order.getId());
                order.setStatus(OrderStatus.PLACED);
        }

        order.setLastReconciledAt(LocalDateTime.now());
        orderRepository.save(order);
    }

    /**
     * Re-enqueue order that was never sent to broker.
     * Only called for orders where brokerOrderId is NULL.
     */
    @Transactional
    protected boolean reEnqueueOrder(Order order) {
        log.info("[RECOVERY] Re-enqueueing order {} (never sent to broker)", order.getId());

        try {
            // Build QueuedOrder from persisted Order entity
            QueuedOrder queuedOrder = QueuedOrder.builder()
                    .userId(order.getUserId())
                    .strategyId(order.getStrategyId())
                    .strategyName(order.getSymbol()) // Strategy name may not be available
                    .symbol(order.getSymbol())
                    .side(order.getSide())
                    .quantity(order.getQuantity())
                    .orderType(order.getOrderType())
                    .limitPrice(order.getLimitPrice())
                    .signalPrice(order.getPlacedPrice() != null ? order.getPlacedPrice() : order.getLimitPrice())
                    .signalTime(order.getCreatedAt())
                    .deduplicationKey(order.getDeduplicationKey())
                    .retryCount(order.getRetryCount())
                    .priority(0) // High priority for recovery orders
                    .build();

            // Force enqueue (bypass deduplication checks - this is recovery)
            boolean enqueued = executionQueue.forceEnqueue(queuedOrder);

            if (enqueued) {
                order.setStatus(OrderStatus.PENDING);
                order.setQueuedAt(LocalDateTime.now());
                orderRepository.save(order);

                log.info("[RECOVERY] ✅ Successfully re-enqueued order {}", order.getId());

                auditService.logInfo(order.getUserId(), "RECOVERY_REQUEUED",
                        String.format("Order %d re-enqueued for execution", order.getId()),
                        null);

                return true;
            } else {
                log.error("[RECOVERY] ❌ Failed to re-enqueue order {} (queue rejected)", order.getId());

                order.setRejectedReason("Recovery failed: queue rejected re-enqueue");
                order.setStatus(OrderStatus.REJECTED);
                orderRepository.save(order);

                return false;
            }

        } catch (Exception e) {
            log.error("[RECOVERY] ❌ Failed to re-enqueue order {}: {}", order.getId(), e.getMessage());

            order.setRejectedReason("Recovery failed: " + e.getMessage());
            order.setStatus(OrderStatus.REJECTED);
            orderRepository.save(order);

            return false;
        }
    }
}
