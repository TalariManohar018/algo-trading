package com.algo.dto;

import com.algo.enums.InstrumentType;
import com.algo.enums.OrderType;
import com.algo.enums.ProductType;
import com.algo.enums.TimeFrame;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStrategyRequest {
    
    @NotBlank(message = "Strategy name is required")
    private String name;
    
    private String description;
    
    @NotBlank(message = "Symbol is required")
    private String symbol;
    
    @NotNull(message = "Instrument type is required")
    private InstrumentType instrumentType;
    
    @NotNull(message = "Timeframe is required")
    private TimeFrame timeframe;
    
    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    private Integer quantity;
    
    @NotNull(message = "Order type is required")
    private OrderType orderType;
    
    @NotNull(message = "Product type is required")
    private ProductType productType;
    
    @NotEmpty(message = "At least one entry condition is required")
    @Valid
    private List<StrategyConditionDTO> entryConditions;
    
    @Valid
    private List<StrategyConditionDTO> exitConditions;
    
    @NotNull(message = "Max trades per day is required")
    @Positive(message = "Max trades per day must be positive")
    private Integer maxTradesPerDay;
    
    @NotNull(message = "Trading window is required")
    @Valid
    private TradingWindowDTO tradingWindow;
    
    @NotNull(message = "Square off time is required")
    private String squareOffTime;  // Format: "HH:mm"
    
    @NotNull(message = "Risk config is required")
    @Valid
    private RiskConfigDTO riskConfig;
}
