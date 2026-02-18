package com.algo.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BacktestResult {
    
    private String strategyName;
    private Integer totalTrades;
    private Integer winningTrades;
    private Integer losingTrades;
    private Double winRate;
    private Double totalPnl;
    private Double averageWin;
    private Double averageLoss;
    private Double maxDrawdown;
    private Double sharpeRatio;
    private Double profitFactor;
    private List<Trade> trades;
    
    public void calculateMetrics() {
        if (trades == null || trades.isEmpty()) {
            return;
        }
        
        totalTrades = trades.size();
        winningTrades = (int) trades.stream().filter(t -> t.getPnl() > 0).count();
        losingTrades = (int) trades.stream().filter(t -> t.getPnl() <= 0).count();
        winRate = (winningTrades * 100.0) / totalTrades;
        
        totalPnl = trades.stream()
                .mapToDouble(t -> t.getPnl() != null ? t.getPnl() : 0.0)
                .sum();
        
        averageWin = trades.stream()
                .filter(t -> t.getPnl() > 0)
                .mapToDouble(Trade::getPnl)
                .average()
                .orElse(0.0);
        
        averageLoss = Math.abs(trades.stream()
                .filter(t -> t.getPnl() <= 0)
                .mapToDouble(Trade::getPnl)
                .average()
                .orElse(0.0));
        
        profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0.0;
        
        // Simplified calculations
        maxDrawdown = calculateMaxDrawdown();
        sharpeRatio = calculateSharpeRatio();
    }
    
    private Double calculateMaxDrawdown() {
        if (trades == null || trades.isEmpty()) {
            return 0.0;
        }
        
        double peak = 0.0;
        double maxDrawdown = 0.0;
        double cumPnl = 0.0;
        
        for (Trade trade : trades) {
            cumPnl += trade.getPnl() != null ? trade.getPnl() : 0.0;
            if (cumPnl > peak) {
                peak = cumPnl;
            }
            double drawdown = peak - cumPnl;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        
        return maxDrawdown;
    }
    
    private Double calculateSharpeRatio() {
        // Simplified Sharpe Ratio calculation
        if (trades == null || trades.isEmpty()) {
            return 0.0;
        }
        
        double avgReturn = totalPnl / totalTrades;
        double variance = trades.stream()
                .mapToDouble(t -> {
                    double pnl = t.getPnl() != null ? t.getPnl() : 0.0;
                    return Math.pow(pnl - avgReturn, 2);
                })
                .average()
                .orElse(0.0);
        
        double stdDev = Math.sqrt(variance);
        return stdDev > 0 ? (avgReturn / stdDev) : 0.0;
    }
}
