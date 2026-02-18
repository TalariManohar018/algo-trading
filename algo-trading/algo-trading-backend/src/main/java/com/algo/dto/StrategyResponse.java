package com.algo.dto;

import com.algo.enums.InstrumentType;
import com.algo.enums.OrderType;
import com.algo.enums.ProductType;
import com.algo.enums.StrategyStatus;
import com.algo.enums.TimeFrame;
import com.algo.model.StrategyCondition;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StrategyResponse {
    
    private Long id;
    private String name;
    private String description;
    private String symbol;
    private InstrumentType instrumentType;
    private TimeFrame timeframe;
    private Integer quantity;
    private OrderType orderType;
    private ProductType productType;
    private List<StrategyConditionDTO> entryConditions;
    private List<StrategyConditionDTO> exitConditions;
    private Integer maxTradesPerDay;
    private TradingWindowDTO tradingWindow;
    private String squareOffTime;
    private RiskConfigDTO riskConfig;
    private StrategyStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
