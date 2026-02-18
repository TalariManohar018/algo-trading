package com.algo.dto;

import com.algo.enums.IndicatorType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConditionRequest {
    
    @NotNull(message = "Indicator is required")
    private IndicatorType indicator;
    
    @NotBlank(message = "Condition operator is required")
    private String condition;
    
    @NotBlank(message = "Value is required")
    private String value;
    
    private String logic; // AND or OR
}
