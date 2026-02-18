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
}
