package com.algo.service;

import com.algo.dto.CandleData;
import com.algo.enums.ConditionLogic;
import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import com.algo.model.StrategyCondition;
import com.algo.service.engine.StrategyEvaluator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Strategy Evaluator
 */
class StrategyEvaluatorTest {
    
    private StrategyEvaluator evaluator;
    private CandleData testCandle;
    
    @BeforeEach
    void setUp() {
        evaluator = new StrategyEvaluator();
        
        // Create test candle: NIFTY at 22,100
        testCandle = new CandleData(
                "NIFTY",
                "1m",
                LocalDateTime.now(),
                22000.0,
                22150.0,
                21950.0,
                22100.0,
                10000L
        );
    }
    
    @Test
    @DisplayName("Should evaluate simple GREATER_THAN condition")
    void testSimpleGreaterThanCondition() {
        StrategyCondition condition = new StrategyCondition();
        condition.setIndicatorType(IndicatorType.PRICE);
        condition.setConditionType(ConditionType.GREATER_THAN);
        condition.setConditionValue(22000.0);
        
        boolean result = evaluator.evaluateEntryConditions(List.of(condition), testCandle);
        
        assertTrue(result, "Price 22100 should be greater than 22000");
    }
    
    @Test
    @DisplayName("Should evaluate simple LESS_THAN condition")
    void testSimpleLessThanCondition() {
        StrategyCondition condition = new StrategyCondition();
        condition.setIndicatorType(IndicatorType.PRICE);
        condition.setConditionType(ConditionType.LESS_THAN);
        condition.setConditionValue(22200.0);
        
        boolean result = evaluator.evaluateEntryConditions(List.of(condition), testCandle);
        
        assertTrue(result, "Price 22100 should be less than 22200");
    }
    
    @Test
    @DisplayName("Should evaluate AND logic between conditions")
    void testAndLogic() {
        StrategyCondition condition1 = new StrategyCondition();
        condition1.setIndicatorType(IndicatorType.PRICE);
        condition1.setConditionType(ConditionType.GREATER_THAN);
        condition1.setConditionValue(22000.0);
        
        StrategyCondition condition2 = new StrategyCondition();
        condition2.setIndicatorType(IndicatorType.PRICE);
        condition2.setConditionType(ConditionType.LESS_THAN);
        condition2.setConditionValue(22200.0);
        condition2.setLogic(ConditionLogic.AND);
        
        boolean result = evaluator.evaluateEntryConditions(List.of(condition1, condition2), testCandle);
        
        assertTrue(result, "Both conditions should be true (22000 < 22100 < 22200)");
    }
    
    @Test
    @DisplayName("Should evaluate OR logic between conditions")
    void testOrLogic() {
        StrategyCondition condition1 = new StrategyCondition();
        condition1.setIndicatorType(IndicatorType.PRICE);
        condition1.setConditionType(ConditionType.GREATER_THAN);
        condition1.setConditionValue(25000.0);  // False
        
        StrategyCondition condition2 = new StrategyCondition();
        condition2.setIndicatorType(IndicatorType.PRICE);
        condition2.setConditionType(ConditionType.LESS_THAN);
        condition2.setConditionValue(23000.0);  // True
        condition2.setLogic(ConditionLogic.OR);
        
        boolean result = evaluator.evaluateEntryConditions(List.of(condition1, condition2), testCandle);
        
        assertTrue(result, "At least one condition should be true (OR logic)");
    }
    
    @Test
    @DisplayName("Should fail when conditions are false")
    void testFailingConditions() {
        StrategyCondition condition = new StrategyCondition();
        condition.setIndicatorType(IndicatorType.PRICE);
        condition.setConditionType(ConditionType.GREATER_THAN);
        condition.setConditionValue(25000.0);
        
        boolean result = evaluator.evaluateEntryConditions(List.of(condition), testCandle);
        
        assertFalse(result, "Price 22100 should not be greater than 25000");
    }
}
