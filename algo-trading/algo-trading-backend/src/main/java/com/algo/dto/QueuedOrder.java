package com.algo.dto;

import com.algo.enums.OrderSide;
import com.algo.enums.OrderType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Immutable order request that travels through the execution pipeline.
 * Produced by TradingEngineService, consumed by OrderQueueWorker.
 */
@Data
@Builder
public class QueuedOrder {

    /** Internal UUID to uniquely identify this request */
    @Builder.Default
    private final String requestId = UUID.randomUUID().toString();

    /** Priority: lower number = higher priority. 0 = stop-loss/critical, 1 = normal entry, 2 = low */
    @Builder.Default
    private int priority = 1;

    // Core order fields -------------------------------------------------

    private Long userId;
    private Long strategyId;
    private String strategyName;
    private String symbol;
    private OrderSide side;
    private Integer quantity;
    private OrderType orderType;

    /** Limit price (null for MARKET orders) */
    private Double limitPrice;

    /** Reference price at signal time — used for slippage calc */
    private Double signalPrice;

    /** Timestamp of the signal — reject if too stale */
    private LocalDateTime signalTime;

    // Dedup / rate-limit fields -----------------------------------------

    /**
     * userId:strategyId:symbol:side:minuteEpoch
     * Shared across queue + Redis so duplicate signals are blocked
     */
    private String deduplicationKey;

    // Risk context passed from engine ------------------------------------

    private Double stopLoss;
    private Double takeProfit;

    /** Slippage estimate at signal time (%) */
    private Double estimatedSlippagePct;

    /** Whether this order bypasses normal slippage gate (e.g. exit / SL hit) */
    @Builder.Default
    private boolean slippageExempt = false;

    // Metadata ----------------------------------------------------------

    /** How many times this order has been retried by the worker */
    @Builder.Default
    private int retryCount = 0;

    private LocalDateTime enqueuedAt;
}
