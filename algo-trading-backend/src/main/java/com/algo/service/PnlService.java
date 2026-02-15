package com.algo.service;

import com.algo.model.Trade;
import com.algo.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PnlService {
    
    private final TradeRepository tradeRepository;
    
    /**
     * Get total PnL across all strategies
     */
    public Double getTotalPnL() {
        List<Trade> allTrades = tradeRepository.findAll();
        return allTrades.stream()
                .filter(t -> !t.getIsOpen() && t.getPnl() != null)
                .mapToDouble(Trade::getPnl)
                .sum();
    }
    
    /**
     * Get PnL for a specific strategy
     */
    public Double getStrategyPnL(Long strategyId) {
        List<Trade> strategyTrades = tradeRepository.findByStrategyId(strategyId);
        return strategyTrades.stream()
                .filter(t -> !t.getIsOpen() && t.getPnl() != null)
                .mapToDouble(Trade::getPnl)
                .sum();
    }
    
    /**
     * Get PnL summary by strategy
     */
    public Map<Long, Double> getPnLByStrategy() {
        List<Trade> allTrades = tradeRepository.findAll();
        return allTrades.stream()
                .filter(t -> !t.getIsOpen() && t.getPnl() != null)
                .collect(Collectors.groupingBy(
                        Trade::getStrategyId,
                        Collectors.summingDouble(Trade::getPnl)
                ));
    }
    
    /**
     * Get win rate for a strategy
     */
    public Double getWinRate(Long strategyId) {
        List<Trade> trades = tradeRepository.findByStrategyId(strategyId);
        long closedTrades = trades.stream().filter(t -> !t.getIsOpen()).count();
        
        if (closedTrades == 0) {
            return 0.0;
        }
        
        long winningTrades = trades.stream()
                .filter(t -> !t.getIsOpen() && t.getPnl() != null && t.getPnl() > 0)
                .count();
        
        return (winningTrades * 100.0) / closedTrades;
    }
    
    /**
     * Get all closed trades
     */
    public List<Trade> getClosedTrades() {
        return tradeRepository.findByIsOpen(false);
    }
    
    /**
     * Get all open trades
     */
    public List<Trade> getOpenTrades() {
        return tradeRepository.findByIsOpen(true);
    }
}
