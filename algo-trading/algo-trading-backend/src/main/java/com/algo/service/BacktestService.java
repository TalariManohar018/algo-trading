package com.algo.service;

import com.algo.dto.BacktestRequest;
import com.algo.enums.OrderSide;
import com.algo.model.BacktestResult;
import com.algo.model.Strategy;
import com.algo.model.Trade;
import com.algo.util.MockDataGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BacktestService {
    
    private final StrategyService strategyService;
    private final ConditionEngineService conditionEngine;
    private final MockDataGenerator dataGenerator;
    
    /**
     * Run backtest for a strategy
     */
    public BacktestResult runBacktest(Long strategyId, BacktestRequest request) {
        Strategy strategy = strategyService.getStrategyEntityById(strategyId);
        
        // Parse dates
        LocalDateTime startDate = parseDate(request.getStartDate());
        LocalDateTime endDate = parseDate(request.getEndDate());
        
        // Generate mock candle data
        List<MockDataGenerator.CandleData> candles = dataGenerator.generateMockCandles(
                strategy.getInstrumentType(),
                startDate,
                endDate
        );
        
        // Run simulation
        List<Trade> trades = simulateTrades(strategy, candles);
        
        // Create result
        BacktestResult result = new BacktestResult();
        result.setStrategyName(strategy.getName());
        result.setTrades(trades);
        result.calculateMetrics();
        
        return result;
    }
    
    /**
     * Simulate trades based on strategy conditions
     */
    private List<Trade> simulateTrades(Strategy strategy, List<MockDataGenerator.CandleData> candles) {
        List<Trade> trades = new ArrayList<>();
        Trade openTrade = null;
        boolean wasSignalActive = false;
        
        for (MockDataGenerator.CandleData candle : candles) {
            double price = candle.close;
            
            // Check if strategy conditions are met
            boolean signalActive = conditionEngine.evaluateStrategy(strategy, price);
            
            // Entry logic
            if (signalActive && !wasSignalActive && openTrade == null) {
                // Open new trade
                openTrade = new Trade();
                openTrade.setStrategyId(strategy.getId());
                openTrade.setStrategyName(strategy.getName());
                openTrade.setInstrument(strategy.getInstrumentType());
                openTrade.setSide(OrderSide.BUY);
                openTrade.setEntryPrice(price);
                openTrade.setQuantity(50);
                openTrade.setEntryTime(candle.timestamp);
                openTrade.setIsOpen(true);
            }
            
            // Exit logic
            if (!signalActive && wasSignalActive && openTrade != null) {
                // Close trade
                openTrade.closeTrade(price, candle.timestamp);
                trades.add(openTrade);
                openTrade = null;
            }
            
            wasSignalActive = signalActive;
        }
        
        // Close any open trade at the end
        if (openTrade != null) {
            MockDataGenerator.CandleData lastCandle = candles.get(candles.size() - 1);
            openTrade.closeTrade(lastCandle.close, lastCandle.timestamp);
            trades.add(openTrade);
        }
        
        return trades;
    }
    
    /**
     * Parse date string to LocalDateTime
     */
    private LocalDateTime parseDate(String dateStr) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            return LocalDateTime.parse(dateStr + "T00:00:00");
        } catch (Exception e) {
            // Default to today
            return LocalDateTime.now();
        }
    }
}
