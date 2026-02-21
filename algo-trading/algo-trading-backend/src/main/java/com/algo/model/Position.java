package com.algo.model;

import com.algo.enums.PositionSide;
import com.algo.enums.PositionStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "positions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Position {
    
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
    private PositionSide side;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Column(nullable = false)
    private Double entryPrice;
    
    @Column(nullable = false)
    private Double currentPrice;
    
    @Column(nullable = false)
    private Double unrealizedPnl = 0.0;
    
    @Column(nullable = false)
    private Double realizedPnl = 0.0;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PositionStatus status;
    
    @Column(nullable = false)
    private LocalDateTime openedAt = LocalDateTime.now();
    
    private LocalDateTime closedAt;

    // ── Production fields ──────────────────────────────────────────────

    /** Stop-loss price for this position */
    private Double stopLoss;

    /** Take-profit price for this position */
    private Double takeProfit;

    /** Distance to stop-loss as % of entry price */
    private Double distanceToSlPct;

    /** Distance to take-profit as % of entry price */
    private Double distanceToTpPct;

    /** Peak unrealised PnL ever reached (for drawdown calc) */
    @Column(nullable = false)
    private Double peakUnrealizedPnl = 0.0;

    /** Max adverse excursion (worst unrealised PnL seen) */
    @Column(nullable = false)
    private Double maxAdverseExcursion = 0.0;

    /** Entry broker order ID (for audit trail) */
    @Column(length = 64)
    private String entryBrokerOrderId;

    /** Exit broker order ID */
    @Column(length = 64)
    private String exitBrokerOrderId;

    /** Reason this position was closed */
    @Column(length = 64)
    private String closeReason;
}
