package com.algo.service;

import com.algo.dto.CreateStrategyRequest;
import com.algo.dto.StrategyResponse;
import com.algo.enums.StrategyStatus;
import com.algo.mapper.StrategyMapper;
import com.algo.model.Strategy;
import com.algo.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StrategyService {
    
    private final StrategyRepository strategyRepository;
    private final StrategyMapper strategyMapper;
    
    /**
     * Get all strategies
     */
    public List<StrategyResponse> getAllStrategies() {
        return strategyRepository.findAll().stream()
                .map(strategyMapper::toResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Get strategy by ID
     */
    public StrategyResponse getStrategyById(Long id) {
        Strategy strategy = strategyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Strategy not found with id: " + id));
        return strategyMapper.toResponse(strategy);
    }
    
    /**
     * Get strategy entity by ID (internal use)
     */
    public Strategy getStrategyEntityById(Long id) {
        return strategyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Strategy not found with id: " + id));
    }
    
    /**
     * Create new strategy
     */
    @Transactional
    public StrategyResponse createStrategy(CreateStrategyRequest request) {
        // Validate strategy
        validateStrategy(request);
        
        // Map DTO to entity
        Strategy strategy = strategyMapper.toEntity(request);
        strategy.setStatus(StrategyStatus.CREATED);
        
        // Save and return
        Strategy savedStrategy = strategyRepository.save(strategy);
        return strategyMapper.toResponse(savedStrategy);
    }
    
    /**
     * Update strategy status
     */
    @Transactional
    public StrategyResponse updateStrategyStatus(Long id, StrategyStatus status) {
        Strategy strategy = getStrategyEntityById(id);
        strategy.setStatus(status);
        Strategy updatedStrategy = strategyRepository.save(strategy);
        return strategyMapper.toResponse(updatedStrategy);
    }
    
    /**
     * Activate strategy (start trading)
     */
    @Transactional
    public StrategyResponse activateStrategy(Long id) {
        return updateStrategyStatus(id, StrategyStatus.RUNNING);
    }
    
    /**
     * Deactivate strategy (stop trading)
     */
    @Transactional
    public StrategyResponse deactivateStrategy(Long id) {
        return updateStrategyStatus(id, StrategyStatus.STOPPED);
    }
    
    /**
     * Delete strategy
     */
    @Transactional
    public void deleteStrategy(Long id) {
        strategyRepository.deleteById(id);
    }
    
    /**
     * Search strategies by name
     */
    public List<StrategyResponse> searchStrategies(String name) {
        return strategyRepository.findByNameContainingIgnoreCase(name).stream()
                .map(strategyMapper::toResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Get running strategies
     */
    public List<Strategy> getRunningStrategies() {
        return strategyRepository.findByStatus(StrategyStatus.RUNNING);
    }
    
    /**
     * Validate strategy before creation
     */
    private void validateStrategy(CreateStrategyRequest request) {
        // Validate trading window
        if (request.getTradingWindow().getStartTime().compareTo(request.getTradingWindow().getEndTime()) >= 0) {
            throw new IllegalArgumentException("Trading window end time must be after start time");
        }
        
        // Validate square off time is after trading window end
        if (request.getSquareOffTime().compareTo(request.getTradingWindow().getEndTime()) <= 0) {
            throw new IllegalArgumentException("Square off time must be after trading window end time");
        }
        
        // Validate entry conditions exist
        if (request.getEntryConditions() == null || request.getEntryConditions().isEmpty()) {
            throw new IllegalArgumentException("At least one entry condition is required");
        }
        
        // Validate risk config
        if (request.getRiskConfig().getMaxLossPerTrade() <= 0) {
            throw new IllegalArgumentException("Max loss per trade must be positive");
        }
    }
}
