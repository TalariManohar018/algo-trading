package com.algo.controller;

import com.algo.dto.StrategyRequest;
import com.algo.enums.StrategyStatus;
import com.algo.model.Strategy;
import com.algo.service.StrategyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StrategyController {
    
    private final StrategyService strategyService;
    
    /**
     * Get all strategies
     */
    @GetMapping
    public ResponseEntity<List<Strategy>> getAllStrategies(@RequestParam(required = false) String search) {
        List<Strategy> strategies;
        if (search != null && !search.isEmpty()) {
            strategies = strategyService.searchStrategies(search);
        } else {
            strategies = strategyService.getAllStrategies();
        }
        return ResponseEntity.ok(strategies);
    }
    
    /**
     * Get strategy by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Strategy> getStrategyById(@PathVariable Long id) {
        Strategy strategy = strategyService.getStrategyById(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Create new strategy
     */
    @PostMapping
    public ResponseEntity<Strategy> createStrategy(@Valid @RequestBody StrategyRequest request) {
        Strategy strategy = strategyService.createStrategy(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(strategy);
    }
    
    /**
     * Activate strategy
     */
    @PutMapping("/{id}/activate")
    public ResponseEntity<Strategy> activateStrategy(@PathVariable Long id) {
        Strategy strategy = strategyService.activateStrategy(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Deactivate strategy
     */
    @PutMapping("/{id}/deactivate")
    public ResponseEntity<Strategy> deactivateStrategy(@PathVariable Long id) {
        Strategy strategy = strategyService.deactivateStrategy(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Delete strategy
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteStrategy(@PathVariable Long id) {
        strategyService.deleteStrategy(id);
        return ResponseEntity.ok(Map.of("message", "Strategy deleted successfully"));
    }
}
