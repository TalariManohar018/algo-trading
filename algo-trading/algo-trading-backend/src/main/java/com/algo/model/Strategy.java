package com.algo.model;

import com.algo.enums.InstrumentType;
import com.algo.enums.OrderType;
import com.algo.enums.ProductType;
import com.algo.enums.StrategyStatus;
import com.algo.enums.TimeFrame;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "strategies")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Strategy {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(nullable = false)
    private String symbol;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InstrumentType instrumentType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TimeFrame timeframe;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType orderType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductType productType;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = StrategyConditionListConverter.class)
    private List<StrategyCondition> entryConditions = new ArrayList<>();
    
    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = StrategyConditionListConverter.class)
    private List<StrategyCondition> exitConditions = new ArrayList<>();
    
    @Column(nullable = false)
    private Integer maxTradesPerDay;
    
    @Embedded
    private TradingWindow tradingWindow;
    
    @Column(nullable = false)
    private LocalTime squareOffTime;
    
    @Embedded
    private RiskConfig riskConfig;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StrategyStatus status = StrategyStatus.CREATED;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = StrategyStatus.CREATED;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
