package com.algo.model;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiskConfig {
    
    private Double maxLossPerTrade;
    private Double maxProfitTarget;
    private Double stopLossPercent;
    private Double takeProfitPercent;
}
