package com.algo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Redis-backed cache for live prices and order state.
 *
 * <p>All methods degrade gracefully if Redis is unavailable — an in-memory
 * fallback map is used so the trading engine never stalls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PriceCacheService {

    private static final String PRICE_KEY_PREFIX  = "price:";
    private static final String ORDER_KEY_PREFIX  = "order:state:";
    private static final String DEDUP_KEY_PREFIX  = "order:dedup:";

    private static final Duration PRICE_TTL      = Duration.ofSeconds(5);
    private static final Duration ORDER_STATE_TTL = Duration.ofMinutes(2);
    private static final Duration DEDUP_TTL       = Duration.ofSeconds(65);

    private final StringRedisTemplate redis;

    // Local fallback maps (used when Redis is unreachable)
    private final ConcurrentHashMap<String, Double> localPriceCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> localOrderStateCache = new ConcurrentHashMap<>();

    // ── Price cache ──────────────────────────────────────────────────────────

    public void setPrice(String symbol, double price) {
        localPriceCache.put(symbol, price);
        try {
            redis.opsForValue().set(PRICE_KEY_PREFIX + symbol, String.valueOf(price), PRICE_TTL);
        } catch (Exception e) {
            log.trace("[CACHE] Redis write failed for price {}: {}", symbol, e.getMessage());
        }
    }

    public double getPrice(String symbol) {
        try {
            String val = redis.opsForValue().get(PRICE_KEY_PREFIX + symbol);
            if (val != null) return Double.parseDouble(val);
        } catch (Exception e) {
            log.trace("[CACHE] Redis read failed for price {}: {}", symbol, e.getMessage());
        }
        return localPriceCache.getOrDefault(symbol, 0.0);
    }

    public Map<String, Double> getAllPrices() {
        Map<String, Double> result = new HashMap<>(localPriceCache);
        try {
            Set<String> keys = redis.keys(PRICE_KEY_PREFIX + "*");
            if (keys != null) {
                for (String key : keys) {
                    String val = redis.opsForValue().get(key);
                    if (val != null) {
                        result.put(key.substring(PRICE_KEY_PREFIX.length()), Double.parseDouble(val));
                    }
                }
            }
        } catch (Exception e) {
            log.trace("[CACHE] Redis getAllPrices failed: {}", e.getMessage());
        }
        return result;
    }

    // ── Order state cache ────────────────────────────────────────────────────

    /**
     * Cache the order status string (for fast lookup without hitting DB).
     *
     * @param brokerOrderId broker-assigned order ID
     * @param status        OrderStatus.name()
     */
    public void setOrderState(String brokerOrderId, String status) {
        localOrderStateCache.put(brokerOrderId, status);
        try {
            redis.opsForValue().set(ORDER_KEY_PREFIX + brokerOrderId, status, ORDER_STATE_TTL);
        } catch (Exception e) {
            log.trace("[CACHE] Redis write failed for order state {}: {}", brokerOrderId, e.getMessage());
        }
    }

    public String getOrderState(String brokerOrderId) {
        try {
            String val = redis.opsForValue().get(ORDER_KEY_PREFIX + brokerOrderId);
            if (val != null) return val;
        } catch (Exception e) {
            log.trace("[CACHE] Redis read failed for order state {}: {}", brokerOrderId, e.getMessage());
        }
        return localOrderStateCache.get(brokerOrderId);
    }

    public void evictOrderState(String brokerOrderId) {
        localOrderStateCache.remove(brokerOrderId);
        try {
            redis.delete(ORDER_KEY_PREFIX + brokerOrderId);
        } catch (Exception e) {
            log.trace("[CACHE] Redis delete failed for order state {}: {}", brokerOrderId, e.getMessage());
        }
    }

    // ── Dedup guard ──────────────────────────────────────────────────────────

    /**
     * Atomically set dedup key if absent.
     *
     * @return true if key was absent (order is unique), false if duplicate
     */
    public boolean claimDedupKey(String dedupKey) {
        try {
            Boolean set = redis.opsForValue().setIfAbsent(DEDUP_KEY_PREFIX + dedupKey, "1", DEDUP_TTL);
            return Boolean.TRUE.equals(set);
        } catch (Exception e) {
            log.warn("[CACHE] Redis dedup check failed for {}: {} — permitting order", dedupKey, e.getMessage());
            return true; // fail-open: let order through if Redis down
        }
    }

    public boolean isDuplicate(String dedupKey) {
        try {
            return Boolean.TRUE.equals(redis.hasKey(DEDUP_KEY_PREFIX + dedupKey));
        } catch (Exception e) {
            return false; // fail-open
        }
    }

    public void releaseDedupKey(String dedupKey) {
        try {
            redis.delete(DEDUP_KEY_PREFIX + dedupKey);
        } catch (Exception e) {
            log.trace("[CACHE] Redis release failed for dedup {}: {}", dedupKey, e.getMessage());
        }
    }
}
