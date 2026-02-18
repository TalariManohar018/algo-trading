package com.algo.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiskConfigDTO {
    
    @NotNull(message = "Max loss per trade is required")
    @Positive(message = "Max loss per trade must be positive")
    private Double maxLossPerTrade;
    
    private Double maxProfitTarget;
    
    private Double stopLossPercent;
    
    private Double takeProfitPercent;
}
