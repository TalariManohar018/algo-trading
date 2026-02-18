package com.algo.model;

import com.algo.enums.ConditionLogic;
import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StrategyCondition {
    
    private String conditionId;
    
    @Enumerated(EnumType.STRING)
    private IndicatorType indicatorType;
    
    @Enumerated(EnumType.STRING)
    private ConditionType conditionType;
    
    private Double conditionValue;
    
    @Enumerated(EnumType.STRING)
    private ConditionLogic logic;
    
    private Integer period;
}
