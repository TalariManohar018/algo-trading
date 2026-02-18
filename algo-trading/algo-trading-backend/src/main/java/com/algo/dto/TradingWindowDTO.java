package com.algo.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TradingWindowDTO {
    
    @NotNull(message = "Start time is required")
    private String startTime;  // Format: "HH:mm"
    
    @NotNull(message = "End time is required")
    private String endTime;    // Format: "HH:mm"
}
