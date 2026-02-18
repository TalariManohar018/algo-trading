package com.algo.service;

import com.algo.dto.CreateStrategyRequest;
import com.algo.dto.StrategyConditionDTO;
import com.algo.dto.ValidationResult;
import com.algo.enums.ConditionLogic;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Strategy Validator Service
 * Comprehensive validation for strategy configurations
 */
@Service
@Slf4j
public class StrategyValidatorService {
    
    /**
     * Validate strategy comprehensively
     */
    public ValidationResult validateStrategy(CreateStrategyRequest strategy) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        
        // Basic validation
        if (strategy.getName() == null || strategy.getName().trim().isEmpty()) {
            errors.add("Strategy name is required");
        }
        
        if (strategy.getSymbol() == null || strategy.getSymbol().trim().isEmpty()) {
            errors.add("Symbol is required");
        }
        
        if (strategy.getQuantity() == null || strategy.getQuantity() <= 0) {
            errors.add("Quantity must be greater than 0");
        }
        
        // Trading window validation
        if (strategy.getTradingWindow() != null) {
            LocalTime start = LocalTime.parse(strategy.getTradingWindow().getStartTime());
            LocalTime end = LocalTime.parse(strategy.getTradingWindow().getEndTime());
            
            if (start != null && end != null && start.compareTo(end) >= 0) {
                errors.add("Trading window end time must be after start time");
            }
            
            // Check market hours (Indian market)
            LocalTime marketOpen = LocalTime.of(9, 15);
            LocalTime marketClose = LocalTime.of(15, 30);
            
            if (start != null && start.isBefore(marketOpen)) {
                warnings.add("Trading window starts before market open (9:15 AM)");
            }
            
            if (end != null && end.isAfter(marketClose)) {
                warnings.add("Trading window extends beyond market close (3:30 PM)");
            }
        } else {
            errors.add("Trading window is required");
        }
        
        // Square off time validation
        if (strategy.getSquareOffTime() != null && strategy.getTradingWindow() != null) {
            LocalTime endTime = LocalTime.parse(strategy.getTradingWindow().getEndTime());
            if (endTime != null && strategy.getSquareOffTime().toString().compareTo(endTime.toString()) <= 0) {
                errors.add("Square off time must be after trading window end time");
            }
        }
        
        // Entry conditions validation
        if (strategy.getEntryConditions() == null || strategy.getEntryConditions().isEmpty()) {
            errors.add("At least one entry condition is required");
        } else {
            validateConditions(strategy.getEntryConditions(), "Entry", errors, warnings);
        }
        
        // Exit conditions validation
        if (strategy.getExitConditions() != null && !strategy.getExitConditions().isEmpty()) {
            validateConditions(strategy.getExitConditions(), "Exit", errors, warnings);
        } else {
            warnings.add("No exit conditions defined - strategy will only exit at square-off time");
        }
        
        // Risk config validation
        if (strategy.getRiskConfig() != null) {
            if (strategy.getRiskConfig().getMaxLossPerTrade() != null && 
                strategy.getRiskConfig().getMaxLossPerTrade() <= 0) {
                errors.add("Max loss per trade must be positive");
            }
            
            if (strategy.getRiskConfig().getMaxProfitTarget() != null && 
                strategy.getRiskConfig().getMaxProfitTarget() <= 0) {
                warnings.add("Max profit target should be positive or null for unlimited");
            }
        } else {
            warnings.add("No risk configuration - using default limits");
        }
        
        // Max trades per day validation
        if (strategy.getMaxTradesPerDay() == null || strategy.getMaxTradesPerDay() <= 0) {
            errors.add("Max trades per day must be greater than 0");
        } else if (strategy.getMaxTradesPerDay() > 20) {
            warnings.add("Max trades per day is high (>20) - ensure adequate capital and risk management");
        }
        
        boolean isValid = errors.isEmpty();
        
        if (isValid) {
            log.info("Strategy validation passed: {}", strategy.getName());
        } else {
            log.warn("Strategy validation failed: {} errors, {} warnings", errors.size(), warnings.size());
        }
        
        return new ValidationResult(isValid, errors, warnings);
    }
    
    /**
     * Validate conditions list
     */
    private void validateConditions(List<StrategyConditionDTO> conditions, String type, 
                                   List<String> errors, List<String> warnings) {
        for (int i = 0; i < conditions.size(); i++) {
            StrategyConditionDTO condition = conditions.get(i);
            
            if (condition.getIndicatorType() == null) {
                errors.add(type + " condition " + (i + 1) + ": Indicator type is required");
            }
            
            if (condition.getConditionType() == null) {
                errors.add(type + " condition " + (i + 1) + ": Condition type is required");
            }
            
            if (condition.getValue() == null) {
                errors.add(type + " condition " + (i + 1) + ": Condition value is required");
            }
            
            // First condition should not have logic
            if (i == 0 && condition.getLogic() != null) {
                warnings.add(type + " condition 1: Logic will be ignored (first condition)");
            }
            
            // Subsequent conditions must have logic
            if (i > 0 && condition.getLogic() == null) {
                errors.add(type + " condition " + (i + 1) + ": Logic (AND/OR) is required");
            }
        }
    }
    
    /**
     * Generate JSON preview of strategy
     */
    public String generateStrategyPreview(CreateStrategyRequest strategy) {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"name\": \"").append(strategy.getName()).append("\",\n");
        json.append("  \"symbol\": \"").append(strategy.getSymbol()).append("\",\n");
        json.append("  \"timeframe\": \"").append(strategy.getTimeframe()).append("\",\n");
        json.append("  \"quantity\": ").append(strategy.getQuantity()).append(",\n");
        json.append("  \"orderType\": \"").append(strategy.getOrderType()).append("\",\n");
        json.append("  \"productType\": \"").append(strategy.getProductType()).append("\",\n");
        
        // Entry conditions
        json.append("  \"entryConditions\": [\n");
        appendConditions(json, strategy.getEntryConditions());
        json.append("  ],\n");
        
        // Exit conditions
        json.append("  \"exitConditions\": [\n");
        if (strategy.getExitConditions() != null) {
            appendConditions(json, strategy.getExitConditions());
        }
        json.append("  ],\n");
        
        // Trading window
        json.append("  \"tradingWindow\": {\n");
        json.append("    \"startTime\": \"").append(strategy.getTradingWindow().getStartTime()).append("\",\n");
        json.append("    \"endTime\": \"").append(strategy.getTradingWindow().getEndTime()).append("\"\n");
        json.append("  },\n");
        
        json.append("  \"squareOffTime\": \"").append(strategy.getSquareOffTime()).append("\",\n");
        json.append("  \"maxTradesPerDay\": ").append(strategy.getMaxTradesPerDay()).append("\n");
        json.append("}\n");
        
        return json.toString();
    }
    
    private void appendConditions(StringBuilder json, List<StrategyConditionDTO> conditions) {
        for (int i = 0; i < conditions.size(); i++) {
            StrategyConditionDTO condition = conditions.get(i);
            json.append("    {\n");
            json.append("      \"indicator\": \"").append(condition.getIndicatorType()).append("\",\n");
            json.append("      \"condition\": \"").append(condition.getConditionType()).append("\",\n");
            json.append("      \"value\": ").append(condition.getValue());
            if (i > 0) {
                json.append(",\n      \"logic\": \"").append(condition.getLogic()).append("\"");
            }
            json.append("\n    }");
            if (i < conditions.size() - 1) {
                json.append(",");
            }
            json.append("\n");
        }
    }
}
