package com.algo.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "risk_state")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskState {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private Long userId;
    
    @Column(nullable = false)
    private Double dailyLoss = 0.0;
    
    @Column(nullable = false)
    private Integer dailyTradeCount = 0;
    
    @Column(nullable = false)
    private Boolean isLocked = false;
    
    private String lockReason;
    
    @Column(nullable = false)
    private LocalDate tradingDate = LocalDate.now();
    
    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
