package com.algo.service;

import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import com.algo.model.Condition;
import com.algo.model.Strategy;
import com.algo.model.StrategyCondition;
import com.algo.util.IndicatorCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConditionEngineService {
    
    private final IndicatorCalculator indicatorCalculator;
    
    /**
     * Calculate all indicators for given symbol and price
     */
    public Map<String, Object> calculateIndicators(String symbol, double currentPrice) {
        Map<String, Object> indicators = new HashMap<>();
        indicators.put("PRICE", currentPrice);
        indicators.put("SMA_20", currentPrice * 0.98); // Mock SMA
        indicators.put("EMA_20", indicatorCalculator.calculateIndicator(IndicatorType.EMA, currentPrice));
        indicators.put("RSI_14", indicatorCalculator.calculateIndicator(IndicatorType.RSI, currentPrice));
        indicators.put("MACD", indicatorCalculator.calculateIndicator(IndicatorType.MACD, currentPrice));
        return indicators;
    }
    
    /**
     * Evaluate a list of conditions
     */
    public boolean evaluateConditions(List<Condition> conditions, Map<String, Object> indicators) {
        if (conditions == null || conditions.isEmpty()) {
            return false;
        }
        
        boolean result = true;
        
        for (int i = 0; i < conditions.size(); i++) {
            Condition condition = conditions.get(i);
            boolean conditionResult = evaluateSingleCondition(condition, indicators);
            
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
    
    private boolean evaluateSingleCondition(Condition condition, Map<String, Object> indicators) {
        String indicatorKey = condition.getIndicator().name();
        Object indicatorObj = indicators.get(indicatorKey);
        
        if (indicatorObj == null) {
            return false;
        }
        
        double indicatorValue = ((Number) indicatorObj).doubleValue();
        double comparisonValue = Double.parseDouble(condition.getValue());
        
        ConditionType conditionType = condition.getConditionType();
        
        return switch (conditionType) {
            case GREATER_THAN -> indicatorValue > comparisonValue;
            case LESS_THAN -> indicatorValue < comparisonValue;
            case GREATER_THAN_EQUAL -> indicatorValue >= comparisonValue;
            case LESS_THAN_EQUAL -> indicatorValue <= comparisonValue;
            case EQUALS -> Math.abs(indicatorValue - comparisonValue) < 0.01;
            case CROSS_ABOVE -> indicatorValue > comparisonValue;
            case CROSS_BELOW -> indicatorValue < comparisonValue;
        };
    }
    
    /**
     * Evaluate all conditions for a strategy
     * Returns true if all conditions are met
     */
    public boolean evaluateStrategy(Strategy strategy, double currentPrice) {
        List<StrategyCondition> conditions = strategy.getEntryConditions();
        
        if (conditions == null || conditions.isEmpty()) {
            return false;
        }
        
        boolean result = true;
        String previousLogic = "AND";
        
        for (int i = 0; i < conditions.size(); i++) {
            StrategyCondition condition = conditions.get(i);
            boolean conditionResult = evaluateCondition(condition, currentPrice);
            
            if (i == 0) {
                result = conditionResult;
            } else {
                if (condition.getLogic() != null && "OR".equalsIgnoreCase(condition.getLogic().name())) {
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
    private boolean evaluateCondition(StrategyCondition condition, double currentPrice) {
        // Get indicator value
        double indicatorValue = indicatorCalculator.calculateIndicator(
                condition.getIndicatorType(), 
                currentPrice
        );
        
        // Parse comparison value
        double comparisonValue = condition.getConditionValue();
        
        // Get condition type
        ConditionType conditionType = condition.getConditionType();
        
        // Evaluate condition
        return switch (conditionType) {
            case GREATER_THAN -> indicatorValue > comparisonValue;
            case LESS_THAN -> indicatorValue < comparisonValue;
            case GREATER_THAN_EQUAL -> indicatorValue >= comparisonValue;
            case LESS_THAN_EQUAL -> indicatorValue <= comparisonValue;
            case EQUALS -> Math.abs(indicatorValue - comparisonValue) < 0.01;
            case CROSS_ABOVE -> indicatorValue > comparisonValue; // Simplified
            case CROSS_BELOW -> indicatorValue < comparisonValue; // Simplified
        };
    }
    
    /**
     * Get detailed evaluation results for debugging
     */
    public String getEvaluationDetails(Strategy strategy, double currentPrice) {
        StringBuilder details = new StringBuilder();
        details.append("Strategy: ").append(strategy.getName()).append("\n");
        details.append("Current Price: ").append(currentPrice).append("\n\n");
        
        for (StrategyCondition condition : strategy.getEntryConditions()) {
            double indicatorValue = indicatorCalculator.calculateIndicator(
                    condition.getIndicatorType(), 
                    currentPrice
            );
            double comparisonValue = condition.getConditionValue();
            boolean result = evaluateCondition(condition, currentPrice);
            
            details.append("Condition: ")
                    .append(condition.getIndicatorType())
                    .append(" ")
                    .append(condition.getConditionType())
                    .append(" ")
                    .append(condition.getConditionValue())
                    .append("\n");
            details.append("  Indicator Value: ").append(indicatorValue).append("\n");
            details.append("  Comparison Value: ").append(comparisonValue).append("\n");
            details.append("  Result: ").append(result ? "✓ PASS" : "✗ FAIL").append("\n\n");
        }
        
        return details.toString();
    }
}
