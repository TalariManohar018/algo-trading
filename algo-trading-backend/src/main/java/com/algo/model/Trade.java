package com.algo.model;

import com.algo.enums.InstrumentType;
import com.algo.enums.OrderSide;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "trades")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Trade {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "strategy_id")
    private Long strategyId;
    
    @Column(name = "strategy_name")
    private String strategyName;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InstrumentType instrument;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderSide side;
    
    @Column(name = "entry_price", nullable = false)
    private Double entryPrice;
    
    @Column(name = "exit_price")
    private Double exitPrice;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Column(name = "entry_time", nullable = false)
    private LocalDateTime entryTime;
    
    @Column(name = "exit_time")
    private LocalDateTime exitTime;
    
    @Column(name = "pnl")
    private Double pnl;
    
    @Column(name = "is_open")
    private Boolean isOpen = true;
    
    public void closeTrade(Double exitPrice, LocalDateTime exitTime) {
        this.exitPrice = exitPrice;
        this.exitTime = exitTime;
        this.isOpen = false;
        calculatePnl();
    }
    
    private void calculatePnl() {
        if (exitPrice != null && entryPrice != null) {
            if (side == OrderSide.BUY) {
                pnl = (exitPrice - entryPrice) * quantity;
            } else {
                pnl = (entryPrice - exitPrice) * quantity;
            }
        }
    }
}
