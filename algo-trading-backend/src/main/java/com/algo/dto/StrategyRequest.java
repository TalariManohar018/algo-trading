package com.algo.dto;

import com.algo.enums.InstrumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StrategyRequest {
    
    @NotBlank(message = "Strategy name is required")
    private String name;
    
    @NotNull(message = "Instrument is required")
    private InstrumentType instrument;
    
    @NotEmpty(message = "At least one condition is required")
    private List<ConditionRequest> conditions;
}
