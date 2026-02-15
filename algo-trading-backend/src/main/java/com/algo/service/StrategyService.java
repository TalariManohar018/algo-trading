package com.algo.service;

import com.algo.dto.ConditionRequest;
import com.algo.dto.StrategyRequest;
import com.algo.enums.StrategyStatus;
import com.algo.model.Condition;
import com.algo.model.Strategy;
import com.algo.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StrategyService {
    
    private final StrategyRepository strategyRepository;
    
    /**
     * Get all strategies
     */
    public List<Strategy> getAllStrategies() {
        return strategyRepository.findAll();
    }
    
    /**
     * Get strategy by ID
     */
    public Strategy getStrategyById(Long id) {
        return strategyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Strategy not found with id: " + id));
    }
    
    /**
     * Create new strategy
     */
    @Transactional
    public Strategy createStrategy(StrategyRequest request) {
        Strategy strategy = new Strategy();
        strategy.setName(request.getName());
        strategy.setInstrument(request.getInstrument());
        strategy.setStatus(StrategyStatus.STOPPED);
        
        // Add conditions
        for (ConditionRequest condReq : request.getConditions()) {
            Condition condition = new Condition();
            condition.setIndicator(condReq.getIndicator());
            condition.setConditionOperator(condReq.getCondition());
            condition.setValue(condReq.getValue());
            condition.setLogicOperator(condReq.getLogic());
            
            strategy.addCondition(condition);
        }
        
        return strategyRepository.save(strategy);
    }
    
    /**
     * Update strategy status
     */
    @Transactional
    public Strategy updateStrategyStatus(Long id, StrategyStatus status) {
        Strategy strategy = getStrategyById(id);
        strategy.setStatus(status);
        return strategyRepository.save(strategy);
    }
    
    /**
     * Activate strategy
     */
    @Transactional
    public Strategy activateStrategy(Long id) {
        return updateStrategyStatus(id, StrategyStatus.RUNNING);
    }
    
    /**
     * Deactivate strategy
     */
    @Transactional
    public Strategy deactivateStrategy(Long id) {
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
    public List<Strategy> searchStrategies(String name) {
        return strategyRepository.findByNameContainingIgnoreCase(name);
    }
}
