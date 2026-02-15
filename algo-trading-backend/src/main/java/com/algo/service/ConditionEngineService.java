package com.algo.service;

import com.algo.enums.ConditionType;
import com.algo.model.Condition;
import com.algo.model.Strategy;
import com.algo.util.IndicatorCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConditionEngineService {
    
    private final IndicatorCalculator indicatorCalculator;
    
    /**
     * Evaluate all conditions for a strategy
     * Returns true if all conditions are met
     */
    public boolean evaluateStrategy(Strategy strategy, double currentPrice) {
        List<Condition> conditions = strategy.getConditions();
        
        if (conditions == null || conditions.isEmpty()) {
            return false;
        }
        
        boolean result = true;
        String previousLogic = "AND";
        
        for (int i = 0; i < conditions.size(); i++) {
            Condition condition = conditions.get(i);
            boolean conditionResult = evaluateCondition(condition, currentPrice);
            
            if (i == 0) {
                result = conditionResult;
            } else {
                if ("OR".equalsIgnoreCase(condition.getLogicOperator())) {
                    result = result || conditionResult;
                } else {
                    result = result && conditionResult;
                }
            }
        }
        
        return result;
    }
    
    /**
     * Evaluate a single condition
     */
    private boolean evaluateCondition(Condition condition, double currentPrice) {
        // Get indicator value
        double indicatorValue = indicatorCalculator.calculateIndicator(
                condition.getIndicator(), 
                currentPrice
        );
        
        // Parse comparison value
        double comparisonValue = indicatorCalculator.parseValue(
                condition.getValue(), 
                currentPrice
        );
        
        // Get condition type
        ConditionType conditionType = condition.getConditionType();
        
        // Evaluate condition
        return switch (conditionType) {
            case GREATER_THAN -> indicatorValue > comparisonValue;
            case LESS_THAN -> indicatorValue < comparisonValue;
            case GREATER_THAN_OR_EQUAL -> indicatorValue >= comparisonValue;
            case LESS_THAN_OR_EQUAL -> indicatorValue <= comparisonValue;
            case EQUALS -> Math.abs(indicatorValue - comparisonValue) < 0.01;
            case CROSSES_ABOVE -> indicatorValue > comparisonValue; // Simplified
            case CROSSES_BELOW -> indicatorValue < comparisonValue; // Simplified
        };
    }
    
    /**
     * Get detailed evaluation results for debugging
     */
    public String getEvaluationDetails(Strategy strategy, double currentPrice) {
        StringBuilder details = new StringBuilder();
        details.append("Strategy: ").append(strategy.getName()).append("\n");
        details.append("Current Price: ").append(currentPrice).append("\n\n");
        
        for (Condition condition : strategy.getConditions()) {
            double indicatorValue = indicatorCalculator.calculateIndicator(
                    condition.getIndicator(), 
                    currentPrice
            );
            double comparisonValue = indicatorCalculator.parseValue(
                    condition.getValue(), 
                    currentPrice
            );
            boolean result = evaluateCondition(condition, currentPrice);
            
            details.append("Condition: ")
                    .append(condition.getIndicator())
                    .append(" ")
                    .append(condition.getConditionOperator())
                    .append(" ")
                    .append(condition.getValue())
                    .append("\n");
            details.append("  Indicator Value: ").append(indicatorValue).append("\n");
            details.append("  Comparison Value: ").append(comparisonValue).append("\n");
            details.append("  Result: ").append(result ? "✓ PASS" : "✗ FAIL").append("\n\n");
        }
        
        return details.toString();
    }
}
