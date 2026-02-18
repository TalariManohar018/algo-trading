package com.algo.util;

import com.algo.enums.IndicatorType;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class IndicatorCalculator {
    
    private final Random random = new Random();
    
    /**
     * Calculate indicator value based on type
     * Note: These are mock/simulated values for demonstration
     */
    public double calculateIndicator(IndicatorType indicator, double currentPrice) {
        return switch (indicator) {
            case EMA -> calculateEMA(currentPrice);
            case SMA -> calculateSMA(currentPrice);
            case RSI -> calculateRSI();
            case VWAP -> calculateVWAP(currentPrice);
            case PRICE -> currentPrice;
            case VOLUME -> calculateVolume();
            case ADX -> calculateADX();
            case MACD -> calculateMACD();
            case BOLLINGER_BANDS -> calculateBollingerBands(currentPrice);
        };
    }
    
    /**
     * Simplified EMA calculation
     */
    private double calculateEMA(double currentPrice) {
        // Simulate EMA as close to current price
        return currentPrice * (0.95 + random.nextDouble() * 0.1);
    }
    
    /**
     * Simplified SMA calculation
     */
    private double calculateSMA(double currentPrice) {
        // Simulate SMA as close to current price
        return currentPrice * (0.95 + random.nextDouble() * 0.1);
    }
    
    /**
     * Simplified RSI calculation
     * Returns value between 0 and 100
     */
    private double calculateRSI() {
        // Random RSI value between 20 and 80
        return 30 + random.nextDouble() * 50;
    }
    
    /**
     * Simplified VWAP calculation
     */
    private double calculateVWAP(double currentPrice) {
        // VWAP typically near current price
        return currentPrice * (0.98 + random.nextDouble() * 0.04);
    }
    
    /**
     * Simulate volume
     */
    private double calculateVolume() {
        return 50000 + random.nextInt(100000);
    }
    
    /**
     * Simplified ADX calculation
     * Returns value between 0 and 100
     */
    private double calculateADX() {
        return 15 + random.nextDouble() * 50;
    }
    
    /**
     * Simplified MACD calculation
     */
    private double calculateMACD() {
        return -5 + random.nextDouble() * 10;
    }
    
    /**
     * Simplified Bollinger Bands calculation
     */
    private double calculateBollingerBands(double currentPrice) {
        return currentPrice * (0.97 + random.nextDouble() * 0.06);
    }
    
    /**
     * Parse value from condition string
     */
    public double parseValue(String value, double currentPrice) {
        try {
            // Check if value is a number
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            // Value might be another indicator like "EMA 50"
            if (value.contains("EMA")) {
                return calculateEMA(currentPrice);
            } else if (value.contains("VWAP")) {
                return calculateVWAP(currentPrice);
            } else if (value.contains("Volume")) {
                return calculateVolume();
            }
            return 0.0;
        }
    }
}
