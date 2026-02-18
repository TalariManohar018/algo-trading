package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CandleData {
    private String symbol;
    private String timeframe;
    private LocalDateTime timestamp;
    private Double open;
    private Double high;
    private Double low;
    private Double close;
    private Long volume;
}
