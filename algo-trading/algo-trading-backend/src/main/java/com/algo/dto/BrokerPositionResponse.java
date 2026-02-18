package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrokerPositionResponse {
    private String symbol;
    private Integer quantity;
    private Double averagePrice;
    private Double lastPrice;
    private Double pnl;
    private String product; // MIS, CNC, NRML
}
