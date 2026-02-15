package com.algo.dto;

import com.algo.enums.InstrumentType;
import com.algo.enums.OrderSide;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TradeResponse {
    
    private Long id;
    private Long strategyId;
    private String strategyName;
    private InstrumentType instrument;
    private OrderSide side;
    private Double entryPrice;
    private Double exitPrice;
    private Integer quantity;
    private LocalDateTime entryTime;
    private LocalDateTime exitTime;
    private Double pnl;
    private Boolean isOpen;
}
