package com.algo.service.engine;

import com.algo.dto.QueuedOrder;
import com.algo.enums.OrderStatus;
import com.algo.enums.OrderType;
import com.algo.model.Order;
import com.algo.model.Position;
import com.algo.repository.OrderRepository;
import com.algo.repository.PositionRepository;
import com.algo.service.AuditService;
import com.algo.service.broker.BrokerService;
import com.algo.service.broker.OrderStatusResponse;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Single-threaded worker that drains the OrderExecutionQueue.
 *
 * <p>Retry policy (per order):
 * <ul>
 *   <li>Attempt 1 — immediate</li>
 *   <li>Attempt 2 — 5 s backoff</li>
 *   <li>Attempt 3 — 15 s backoff</li>
 *   <li>Attempt 4 — 45 s backoff, then REJECTED</li>
 * </ul>
 *
 * <p>All state transitions are persisted in the orders table.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderQueueWorker {

    private static final long[] RETRY_DELAYS_MS = {0, 5_000, 15_000, 45_000};

    private final OrderExecutionQueue queue;
    private final OrderRepository orderRepository;
    private final PositionRepository positionRepository;
    private final BrokerService brokerService;
    private final AuditService auditService;

    @Value("${trading.execution.worker-enabled:true}")
    private boolean workerEnabled;

    private volatile boolean running = false;
    private ExecutorService executor;

    @PostConstruct
    public void start() {
        if (!workerEnabled) {
            log.info("[WORKER] OrderQueueWorker disabled via config");
            return;
        }
        running = true;
        executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "order-queue-worker");
            t.setDaemon(true);
            return t;
        });
        executor.submit(this::workerLoop);
        log.info("[WORKER] OrderQueueWorker started");
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (executor != null) {
            executor.shutdownNow();
            try {
                executor.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
        log.info("[WORKER] OrderQueueWorker stopped");
    }

    private void workerLoop() {
        while (running) {
            try {
                QueuedOrder queuedOrder = queue.poll(1_000);
                if (queuedOrder == null) continue;

                processWithRetry(queuedOrder);

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("[WORKER] Unexpected error in worker loop", e);
            }
        }
    }

    private void processWithRetry(QueuedOrder queuedOrder) {
        int maxAttempts = queuedOrder.getRetryCount() + 3; // up to 3 retries from current state

        for (int attempt = 0; attempt <= 3; attempt++) {
            // Backoff before retry
            long delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
            if (delay > 0) {
                log.info("[WORKER] Retry #{} for {} in {}ms", attempt,
                        queuedOrder.getRequestId(), delay);
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }

            boolean success = attemptExecution(queuedOrder, attempt);
            if (success) {
                return;
            }

            if (attempt == 3) {
                markOrderFinallyRejected(queuedOrder, "Max retries (3) exhausted");
                return;
            }
        }
    }

    @Transactional
    protected boolean attemptExecution(QueuedOrder queuedOrder, int attempt) {
        Order order = null;
        try {
            log.info("[WORKER] Executing order attempt #{}: {} {} {} qty={} strategy={}",
                    attempt + 1, queuedOrder.getSymbol(), queuedOrder.getSide(),
                    queuedOrder.getOrderType(), queuedOrder.getQuantity(),
                    queuedOrder.getStrategyName());

            // Persist order in PENDING state
            order = buildOrder(queuedOrder);
            order = orderRepository.save(order);

            // Hit the broker
            String brokerOrderId = brokerService.placeOrder(order);
            order.setBrokerOrderId(brokerOrderId);
            order.setStatus(OrderStatus.PLACED);
            order.setPlacedAt(LocalDateTime.now());
            order.setPlacedPrice(queuedOrder.getSignalPrice());
            order.setRetryCount(attempt);
            order = orderRepository.save(order);

            // Immediate status check (some brokers fill synchronously)
            OrderStatusResponse statusResponse = brokerService.getOrderStatus(brokerOrderId);
            applyBrokerStatus(order, statusResponse, queuedOrder);

            auditService.logInfo(queuedOrder.getUserId(), "ORDER_PLACED",
                    String.format("Order placed: %s %s x%d @ ₹%.2f | brokerOrderId=%s",
                            order.getSymbol(), order.getSide(), order.getQuantity(),
                            queuedOrder.getSignalPrice(), brokerOrderId),
                    Map.of("orderId", order.getId(), "attempt", attempt + 1));

            return true;

        } catch (Exception e) {
            log.warn("[WORKER] Attempt #{} failed for {}: {}",
                    attempt + 1, queuedOrder.getRequestId(), e.getMessage());

            if (order != null) {
                order.setRetryCount(attempt + 1);
                order.setRejectedReason("Attempt " + (attempt + 1) + " failed: " + e.getMessage());
                orderRepository.save(order);
            }

            auditService.logWarning(queuedOrder.getUserId(), "ORDER_RETRY",
                    String.format("Attempt #%d failed for %s: %s",
                            attempt + 1, queuedOrder.getRequestId(), e.getMessage()), null);
            return false;
        }
    }

    @Transactional
    protected void applyBrokerStatus(Order order, OrderStatusResponse resp, QueuedOrder queuedOrder) {
        if (resp == null) return;

        switch (resp.getStatus()) {
            case FILLED -> {
                double filled = resp.getFilledPrice();
                double slippage = queuedOrder.getSignalPrice() > 0
                        ? Math.abs((filled - queuedOrder.getSignalPrice()) / queuedOrder.getSignalPrice()) * 100
                        : 0;

                order.setStatus(OrderStatus.FILLED);
                order.setFilledPrice(filled);
                order.setFilledQuantity(order.getQuantity());
                order.setFilledAt(LocalDateTime.now());
                order.setSlippageActualPct(slippage);
                orderRepository.save(order);

                // Create or update position
                openPosition(order, queuedOrder, filled);

                log.info("[WORKER] FILLED: {} x{} @ ₹{} slippage={}%",
                        order.getSymbol(), order.getFilledQuantity(), filled,
                        String.format("%.3f", slippage));

                auditService.logInfo(order.getUserId(), "ORDER_FILLED",
                        String.format("Filled: %s x%d @ ₹%.2f slippage=%.3f%%",
                                order.getSymbol(), order.getQuantity(), filled, slippage),
                        Map.of("orderId", order.getId()));
            }
            case PARTIALLY_FILLED -> {
                order.setStatus(OrderStatus.PARTIALLY_FILLED);
                order.setFilledQuantity(resp.getFilledQuantity() != null ? resp.getFilledQuantity() : 0);
                order.setFilledPrice(resp.getFilledPrice());
                orderRepository.save(order);
                log.info("[WORKER] PARTIAL FILL: {} {}/{} filled @ ₹{}",
                        order.getSymbol(), order.getFilledQuantity(), order.getQuantity(), resp.getFilledPrice());
            }
            case REJECTED -> {
                order.setStatus(OrderStatus.REJECTED);
                order.setRejectedReason(resp.getMessage());
                orderRepository.save(order);
                log.warn("[WORKER] REJECTED: {} reason={}", order.getSymbol(), resp.getMessage());
                auditService.logWarning(order.getUserId(), "ORDER_REJECTED",
                        "Broker rejected: " + resp.getMessage(),
                        Map.of("orderId", order.getId()));
            }
            default -> log.debug("[WORKER] Order status={} — reconciliation will finalize it", resp.getStatus());
        }
    }

    private void openPosition(Order order, QueuedOrder queuedOrder, double entryPrice) {
        // Check if position already exists (idempotent)
        boolean exists = positionRepository
                .findByUserIdAndStrategyIdAndStatus(order.getUserId(), order.getStrategyId(),
                        com.algo.enums.PositionStatus.OPEN)
                .stream().anyMatch(p -> p.getSymbol().equals(order.getSymbol()));

        if (exists) {
            log.warn("[WORKER] Position already open for strategy {} symbol {} — skipping create",
                    order.getStrategyId(), order.getSymbol());
            return;
        }

        Position position = new Position();
        position.setUserId(order.getUserId());
        position.setStrategyId(order.getStrategyId());
        position.setStrategyName(order.getStrategyName());
        position.setSymbol(order.getSymbol());
        position.setSide(order.getSide() == com.algo.enums.OrderSide.BUY
                ? com.algo.enums.PositionSide.LONG : com.algo.enums.PositionSide.SHORT);
        position.setQuantity(order.getFilledQuantity());
        position.setEntryPrice(entryPrice);
        position.setCurrentPrice(entryPrice);
        position.setUnrealizedPnl(0.0);
        position.setRealizedPnl(0.0);
        position.setStatus(com.algo.enums.PositionStatus.OPEN);
        position.setOpenedAt(LocalDateTime.now());
        position.setStopLoss(queuedOrder.getStopLoss());
        position.setTakeProfit(queuedOrder.getTakeProfit());
        position.setEntryBrokerOrderId(order.getBrokerOrderId());

        if (queuedOrder.getStopLoss() != null) {
            position.setDistanceToSlPct(
                    Math.abs((entryPrice - queuedOrder.getStopLoss()) / entryPrice) * 100);
        }
        if (queuedOrder.getTakeProfit() != null) {
            position.setDistanceToTpPct(
                    Math.abs((queuedOrder.getTakeProfit() - entryPrice) / entryPrice) * 100);
        }

        positionRepository.save(position);
        log.info("[WORKER] Position created: {} x{} @ ₹{} SL={} TP={}",
                order.getSymbol(), position.getQuantity(), entryPrice,
                queuedOrder.getStopLoss(), queuedOrder.getTakeProfit());
    }

    private void markOrderFinallyRejected(QueuedOrder queuedOrder, String reason) {
        log.error("[WORKER] Permanently rejected order {}: {}", queuedOrder.getRequestId(), reason);
        auditService.logError(queuedOrder.getUserId(), "ORDER_REJECTED",
                "Order permanently rejected after max retries: " + reason,
                Map.of("deduplicationKey", queuedOrder.getDeduplicationKey() != null
                        ? queuedOrder.getDeduplicationKey() : "N/A"));
    }

    private Order buildOrder(QueuedOrder qo) {
        return Order.builder()
                .userId(qo.getUserId())
                .strategyId(qo.getStrategyId())
                .strategyName(qo.getStrategyName())
                .symbol(qo.getSymbol())
                .side(qo.getSide())
                .quantity(qo.getQuantity())
                .orderType(qo.getOrderType() != null ? qo.getOrderType() : OrderType.MARKET)
                .limitPrice(qo.getLimitPrice())
                .status(OrderStatus.PENDING)
                .deduplicationKey(qo.getDeduplicationKey())
                .slippageExpectedPct(qo.getEstimatedSlippagePct())
                .queuedAt(qo.getEnqueuedAt())
                .createdAt(LocalDateTime.now())
                .build();
    }
}
