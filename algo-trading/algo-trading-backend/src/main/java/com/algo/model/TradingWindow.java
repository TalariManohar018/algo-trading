package com.algo.model;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TradingWindow {
    
    private LocalTime startTime;
    private LocalTime endTime;
}
