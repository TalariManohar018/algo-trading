package com.algo.controller;

import com.algo.dto.CreateStrategyRequest;
import com.algo.dto.StrategyResponse;
import com.algo.dto.ValidationResult;
import com.algo.enums.StrategyStatus;
import com.algo.service.StrategyService;
import com.algo.service.StrategyValidatorService;
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
    private final StrategyValidatorService validatorService;
    
    /**
     * Get all strategies
     */
    @GetMapping
    public ResponseEntity<List<StrategyResponse>> getAllStrategies(@RequestParam(required = false) String search) {
        List<StrategyResponse> strategies;
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
    public ResponseEntity<StrategyResponse> getStrategyById(@PathVariable Long id) {
        StrategyResponse strategy = strategyService.getStrategyById(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Create new strategy
     */
    @PostMapping
    public ResponseEntity<StrategyResponse> createStrategy(@Valid @RequestBody CreateStrategyRequest request) {
        StrategyResponse strategy = strategyService.createStrategy(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(strategy);
    }
    
    /**
     * Activate strategy
     */
    @PutMapping("/{id}/activate")
    public ResponseEntity<StrategyResponse> activateStrategy(@PathVariable Long id) {
        StrategyResponse strategy = strategyService.activateStrategy(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Deactivate strategy
     */
    @PutMapping("/{id}/deactivate")
    public ResponseEntity<StrategyResponse> deactivateStrategy(@PathVariable Long id) {
        StrategyResponse strategy = strategyService.deactivateStrategy(id);
        return ResponseEntity.ok(strategy);
    }
    
    /**
     * Update strategy status
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<StrategyResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam StrategyStatus status) {
        StrategyResponse strategy = strategyService.updateStrategyStatus(id, status);
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
    
    /**
     * Validate strategy
     */
    @PostMapping("/validate")
    public ResponseEntity<ValidationResult> validateStrategy(@Valid @RequestBody CreateStrategyRequest request) {
        ValidationResult result = validatorService.validateStrategy(request);
        return ResponseEntity.ok(result);
    }
    
    /**
     * Preview strategy as JSON
     */
    @PostMapping("/preview")
    public ResponseEntity<Map<String, String>> previewStrategy(@Valid @RequestBody CreateStrategyRequest request) {
        String preview = validatorService.generateStrategyPreview(request);
        return ResponseEntity.ok(Map.of("preview", preview));
    }
}
