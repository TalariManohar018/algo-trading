package com.algo.dto;

import com.algo.enums.ConditionLogic;
import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StrategyConditionDTO {
    
    private String id;
    
    @NotNull(message = "Indicator type is required")
    private IndicatorType indicatorType;
    
    @NotNull(message = "Condition type is required")
    private ConditionType conditionType;
    
    @NotNull(message = "Value is required")
    private Double value;
    
    private ConditionLogic logic;
    
    private Integer period;
}
