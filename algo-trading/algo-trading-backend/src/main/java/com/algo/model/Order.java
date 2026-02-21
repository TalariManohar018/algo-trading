package com.algo.model;

import com.algo.enums.OrderSide;
import com.algo.enums.OrderStatus;
import com.algo.enums.OrderType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long userId;
    
    @Column(nullable = false)
    private Long strategyId;
    
    @Column(nullable = false)
    private String strategyName;
    
    @Column(nullable = false)
    private String symbol;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderSide side;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType orderType;
    
    private Double limitPrice;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;
    
    private Double placedPrice;
    
    private Double filledPrice;
    
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    private LocalDateTime placedAt;
    
    private LocalDateTime filledAt;
    
    private String rejectedReason;

    // ── Production fields ──────────────────────────────────────────────

    /** Broker-assigned order ID returned on placement */
    @Column(length = 64)
    private String brokerOrderId;

    /** How many shares were actually filled (supports partial fills) */
    @Column(nullable = false)
    private Integer filledQuantity = 0;

    /** Deduplication key: userId:strategyId:symbol:side:minuteEpoch */
    @Column(length = 128, unique = true)
    private String deduplicationKey;

    /** Number of broker placement retries attempted */
    @Column(nullable = false)
    private Integer retryCount = 0;

    /** Max retries allowed for this order */
    @Column(nullable = false)
    private Integer maxRetries = 3;

    /** Actual slippage vs reference price (%) */
    private Double slippageActualPct;

    /** Expected slippage at signal time (%) */
    private Double slippageExpectedPct;

    /** Whether slippage check caused rejection */
    @Column(nullable = false)
    private Boolean slippageRejected = false;

    /** Timestamp when order was enqueued for execution */
    private LocalDateTime queuedAt;

    /** Timestamp when order was cancelled (stale / manual) */
    private LocalDateTime cancelledAt;

    /** Last time this order was checked against broker */
    private LocalDateTime lastReconciledAt;

    /** Reconciliation mismatch notes */
    @Column(columnDefinition = "TEXT")
    private String reconciliationNotes;
}
