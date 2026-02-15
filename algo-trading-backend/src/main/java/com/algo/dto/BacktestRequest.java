package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BacktestRequest {
    
    private String startDate;
    private String endDate;
    private Integer initialCapital = 100000;
}
