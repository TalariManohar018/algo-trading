package com.algo.service.engine;

import com.algo.dto.QueuedOrder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe, per-user order execution queue.
 *
 * <p>Pipeline guarantee:
 * <pre>
 *   enqueue()
 *     → duplicate check (Redis + local)
 *     → depth check
 *     → insert by priority
 *   worker drains via take()
 * </pre>
 *
 * <p>Deduplication uses Redis key TTL of 62 seconds so the same signal
 * cannot re-fire within the same 1-minute candle across multiple instances.
 */
@Component
@Slf4j
public class OrderExecutionQueue {

    private static final int MAX_QUEUE_DEPTH = 20;
    private static final long MIN_ENQUEUE_GAP_MS = 300;            // rate-limit per user
    private static final Duration DEDUP_TTL = Duration.ofSeconds(62);
    private static final String DEDUP_KEY_PREFIX = "order:dedup:";

    private final PriorityBlockingQueue<QueuedOrder> queue =
            new PriorityBlockingQueue<>(64, Comparator.comparingInt(QueuedOrder::getPriority));

    private final ConcurrentHashMap<String, Boolean> localDedup = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Long> lastEnqueueMs = new ConcurrentHashMap<>();

    private final StringRedisTemplate redis;

    // Metrics
    private final AtomicLong totalEnqueued = new AtomicLong();
    private final AtomicLong totalDroppedDuplicates = new AtomicLong();
    private final AtomicLong totalDroppedDepth = new AtomicLong();
    private final AtomicLong totalDroppedRateLimit = new AtomicLong();

    @Value("${trading.execution.redis-dedup-enabled:true}")
    private boolean redisDedupEnabled;

    public OrderExecutionQueue(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Attempt to enqueue an order.
     *
     * @return true if accepted, false if rejected (dedup / rate-limit / full)
     */
    public boolean enqueue(QueuedOrder order) {

        String dedupKey = order.getDeduplicationKey();

        // 1. Deduplication check (Redis — cross-instance safe)
        if (dedupKey != null && redisDedupEnabled) {
            Boolean alreadyExists = redis.hasKey(DEDUP_KEY_PREFIX + dedupKey);
            if (Boolean.TRUE.equals(alreadyExists)) {
                log.debug("[QUEUE] Duplicate rejected (Redis): {}", dedupKey);
                totalDroppedDuplicates.incrementAndGet();
                return false;
            }
        }

        // 2. Local dedup guard (fallback when Redis unavailable)
        if (dedupKey != null && localDedup.putIfAbsent(dedupKey, Boolean.TRUE) != null) {
            log.debug("[QUEUE] Duplicate rejected (local): {}", dedupKey);
            totalDroppedDuplicates.incrementAndGet();
            return false;
        }

        // 3. Per-user rate-limit
        long now = System.currentTimeMillis();
        Long last = lastEnqueueMs.get(order.getUserId());
        if (last != null && (now - last) < MIN_ENQUEUE_GAP_MS) {
            log.warn("[QUEUE] Rate-limit hit for user {}: {}ms since last enqueue",
                    order.getUserId(), now - last);
            if (dedupKey != null) localDedup.remove(dedupKey);
            totalDroppedRateLimit.incrementAndGet();
            return false;
        }

        // 4. Depth check
        if (queue.size() >= MAX_QUEUE_DEPTH) {
            log.warn("[QUEUE] Queue full ({} items). Dropping order for strategy {}",
                    MAX_QUEUE_DEPTH, order.getStrategyId());
            if (dedupKey != null) localDedup.remove(dedupKey);
            totalDroppedDepth.incrementAndGet();
            return false;
        }

        // 5. Accept
        order.setEnqueuedAt(LocalDateTime.now());
        queue.put(order);
        lastEnqueueMs.put(order.getUserId(), now);
        totalEnqueued.incrementAndGet();

        // Mark in Redis for cross-instance dedup
        if (dedupKey != null && redisDedupEnabled) {
            try {
                redis.opsForValue().set(DEDUP_KEY_PREFIX + dedupKey, "1", DEDUP_TTL);
            } catch (Exception e) {
                log.warn("[QUEUE] Redis set failed, relying on local dedup: {}", e.getMessage());
            }
        }

        log.info("[QUEUE] Accepted: {} {} {} qty={} priority={}",
                order.getSymbol(), order.getSide(), order.getStrategyName(),
                order.getQuantity(), order.getPriority());
        return true;
    }

    /**
     * Force enqueue order bypassing deduplication checks.
     * Used for crash recovery to re-enqueue failed orders.
     * Still respects queue depth limits for safety.
     * 
     * @return true if accepted, false if queue is full
     */
    public boolean forceEnqueue(QueuedOrder order) {
        // Check depth limit only
        if (queue.size() >= MAX_QUEUE_DEPTH) {
            log.warn("[QUEUE] Force-enqueue REJECTED: queue full ({}/{})",
                    queue.size(), MAX_QUEUE_DEPTH);
            totalDroppedDepth.incrementAndGet();
            return false;
        }

        queue.offer(order);
        totalEnqueued.incrementAndGet();
        
        log.info("[QUEUE] Force-enqueued (recovery): {} {} {} qty={} priority={}",
                order.getSymbol(), order.getSide(), order.getStrategyName(),
                order.getQuantity(), order.getPriority());
        
        return true;
    }

    /**
     * Blocking take — called by OrderQueueWorker.
     */
    public QueuedOrder take() throws InterruptedException {
        return queue.take();
    }

    /**
     * Poll with timeout — non-blocking variant for worker loop.
     */
    public QueuedOrder poll(long timeoutMs) throws InterruptedException {
        return queue.poll(timeoutMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Called on every 1-minute candle close to clear per-candle local dedup
     * so fresh signals on the next candle are accepted.
     * Redis TTL handles the cross-instance expiry automatically.
     */
    public void clearLocalDedupForNewCandle() {
        int cleared = localDedup.size();
        localDedup.clear();
        if (cleared > 0) log.debug("[QUEUE] Cleared {} local dedup entries on candle close", cleared);
    }

    /** Drain all queued orders for a specific user (emergency stop). */
    public int drainUser(Long userId) {
        List<QueuedOrder> toRemove = queue.stream()
                .filter(o -> o.getUserId().equals(userId))
                .toList();
        toRemove.forEach(queue::remove);
        int count = toRemove.size();
        log.warn("[QUEUE] Drained {} orders for user {}", count, userId);
        return count;
    }

    public int size() { return queue.size(); }

    public Map<String, Long> getMetrics() {
        return Map.of(
                "totalEnqueued", totalEnqueued.get(),
                "totalDroppedDuplicates", totalDroppedDuplicates.get(),
                "totalDroppedDepth", totalDroppedDepth.get(),
                "totalDroppedRateLimit", totalDroppedRateLimit.get(),
                "currentDepth", (long) queue.size()
        );
    }
}
