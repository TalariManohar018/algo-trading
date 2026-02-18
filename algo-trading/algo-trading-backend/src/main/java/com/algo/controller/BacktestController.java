package com.algo.controller;

import com.algo.dto.BacktestRequest;
import com.algo.model.BacktestResult;
import com.algo.service.BacktestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/backtest")
@RequiredArgsConstructor
public class BacktestController {
    
    private final BacktestService backtestService;
    
    /**
     * Run backtest for a strategy
     */
    @PostMapping("/{strategyId}")
    public ResponseEntity<BacktestResult> runBacktest(
            @PathVariable Long strategyId,
            @RequestBody BacktestRequest request) {
        
        BacktestResult result = backtestService.runBacktest(strategyId, request);
        return ResponseEntity.ok(result);
    }
}
