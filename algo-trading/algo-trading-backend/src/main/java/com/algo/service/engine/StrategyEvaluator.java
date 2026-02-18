package com.algo.service.engine;

import com.algo.dto.CandleData;
import com.algo.enums.ConditionLogic;
import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import com.algo.model.StrategyCondition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Strategy Evaluator
 * Evaluates strategy conditions against market data
 */
@Service
@Slf4j
public class StrategyEvaluator {
    
    /**
     * Evaluate entry conditions for a strategy
     */
    public boolean evaluateEntryConditions(List<StrategyCondition> conditions, CandleData candle) {
        return evaluateConditions(conditions, candle);
    }
    
    /**
     * Evaluate exit conditions for a strategy
     */
    public boolean evaluateExitConditions(List<StrategyCondition> conditions, CandleData candle) {
        return evaluateConditions(conditions, candle);
    }
    
    /**
     * Evaluate a list of conditions with AND/OR logic
     */
    private boolean evaluateConditions(List<StrategyCondition> conditions, CandleData candle) {
        if (conditions == null || conditions.isEmpty()) {
            return false;
        }
        
        // Calculate all indicators
        Map<IndicatorType, Double> indicators = calculateIndicators(candle);
        
        boolean result = evaluateSingleCondition(conditions.get(0), indicators);
        
        for (int i = 1; i < conditions.size(); i++) {
            StrategyCondition condition = conditions.get(i);
            boolean conditionResult = evaluateSingleCondition(condition, indicators);
            
            if (condition.getLogic() == ConditionLogic.OR) {
                result = result || conditionResult;
            } else {
                result = result && conditionResult;
            }
        }
        
        return result;
    }
    
    /**
     * Evaluate a single condition
     */
    private boolean evaluateSingleCondition(StrategyCondition condition, Map<IndicatorType, Double> indicators) {
        Double indicatorValue = indicators.get(condition.getIndicatorType());
        
        if (indicatorValue == null) {
            log.warn("Indicator {} not available", condition.getIndicatorType());
            return false;
        }
        
        double targetValue = condition.getConditionValue();
        
        return switch (condition.getConditionType()) {
            case GREATER_THAN -> indicatorValue > targetValue;
            case LESS_THAN -> indicatorValue < targetValue;
            case GREATER_THAN_EQUAL -> indicatorValue >= targetValue;
            case LESS_THAN_EQUAL -> indicatorValue <= targetValue;
            case EQUALS -> Math.abs(indicatorValue - targetValue) < 0.01;
            case CROSS_ABOVE -> indicatorValue > targetValue;  // Simplified for now
            case CROSS_BELOW -> indicatorValue < targetValue;  // Simplified for now
        };
    }
    
    /**
     * Calculate all indicators from candle data
     * Simplified - in production, use TA-Lib or similar
     */
    private Map<IndicatorType, Double> calculateIndicators(CandleData candle) {
        Map<IndicatorType, Double> indicators = new HashMap<>();
        
        // Basic price indicators
        indicators.put(IndicatorType.PRICE, candle.getClose());
        indicators.put(IndicatorType.VOLUME, candle.getVolume().doubleValue());
        
        // Simplified indicators (use real TA library in production)
        indicators.put(IndicatorType.EMA, candle.getClose());  // Placeholder
        indicators.put(IndicatorType.SMA, candle.getClose());  // Placeholder
        indicators.put(IndicatorType.RSI, 50.0);  // Placeholder
        indicators.put(IndicatorType.VWAP, candle.getClose());  // Placeholder
        indicators.put(IndicatorType.MACD, 0.0);  // Placeholder
        indicators.put(IndicatorType.ADX, 25.0);  // Placeholder
        indicators.put(IndicatorType.BOLLINGER_BANDS, candle.getClose());  // Placeholder
        
        return indicators;
    }
}
