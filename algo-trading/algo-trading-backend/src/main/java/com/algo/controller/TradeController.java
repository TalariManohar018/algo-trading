package com.algo.controller;

import com.algo.model.Trade;
import com.algo.repository.TradeRepository;
import com.algo.service.PnlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {
    
    private final TradeRepository tradeRepository;
    private final PnlService pnlService;
    
    /**
     * Get all trades
     */
    @GetMapping
    public ResponseEntity<List<Trade>> getAllTrades(@RequestParam(required = false) Boolean open) {
        List<Trade> trades;
        if (open != null) {
            trades = tradeRepository.findByIsOpen(open);
        } else {
            trades = tradeRepository.findAll();
        }
        return ResponseEntity.ok(trades);
    }
    
    /**
     * Get trades for a specific strategy
     */
    @GetMapping("/strategy/{strategyId}")
    public ResponseEntity<List<Trade>> getTradesByStrategy(@PathVariable Long strategyId) {
        List<Trade> trades = tradeRepository.findByStrategyId(strategyId);
        return ResponseEntity.ok(trades);
    }
    
    /**
     * Get trade by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Trade> getTradeById(@PathVariable Long id) {
        return tradeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Get total PnL
     */
    @GetMapping("/pnl/total")
    public ResponseEntity<Map<String, Double>> getTotalPnL() {
        Double totalPnl = pnlService.getTotalPnL();
        return ResponseEntity.ok(Map.of("totalPnl", totalPnl));
    }
    
    /**
     * Get PnL by strategy
     */
    @GetMapping("/pnl/by-strategy")
    public ResponseEntity<Map<Long, Double>> getPnLByStrategy() {
        Map<Long, Double> pnlByStrategy = pnlService.getPnLByStrategy();
        return ResponseEntity.ok(pnlByStrategy);
    }
    
    /**
     * Get win rate for a strategy
     */
    @GetMapping("/winrate/{strategyId}")
    public ResponseEntity<Map<String, Double>> getWinRate(@PathVariable Long strategyId) {
        Double winRate = pnlService.getWinRate(strategyId);
        return ResponseEntity.ok(Map.of("winRate", winRate));
    }
}
