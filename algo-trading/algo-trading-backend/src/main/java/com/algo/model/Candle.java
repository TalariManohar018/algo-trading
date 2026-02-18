package com.algo.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "candles", indexes = {
    @Index(name = "idx_candles_symbol_timeframe", columnList = "symbol,timeframe,timestamp")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Candle {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String symbol;
    
    @Column(nullable = false)
    private String timeframe;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column(nullable = false)
    private Double open;
    
    @Column(nullable = false)
    private Double high;
    
    @Column(nullable = false)
    private Double low;
    
    @Column(nullable = false)
    private Double close;
    
    @Column(nullable = false)
    private Long volume;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
