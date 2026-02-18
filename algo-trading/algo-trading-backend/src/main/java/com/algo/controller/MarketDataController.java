package com.algo.controller;

import com.algo.dto.CandleData;
import com.algo.service.market.MarketDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market-data")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MarketDataController {
    
    private final MarketDataService marketDataService;
    
    /**
     * Start market data simulator
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startMarketData() {
        marketDataService.start();
        return ResponseEntity.ok(Map.of(
            "status", "started",
            "running", marketDataService.isRunning()
        ));
    }
    
    /**
     * Stop market data simulator
     */
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stopMarketData() {
        marketDataService.stop();
        return ResponseEntity.ok(Map.of(
            "status", "stopped",
            "running", marketDataService.isRunning()
        ));
    }
    
    /**
     * Get market data status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
            "running", marketDataService.isRunning()
        ));
    }
    
    /**
     * Get current price for a symbol
     */
    @GetMapping("/price/{symbol}")
    public ResponseEntity<Map<String, Object>> getCurrentPrice(@PathVariable String symbol) {
        Double price = marketDataService.getCurrentPrice(symbol);
        return ResponseEntity.ok(Map.of(
            "symbol", symbol,
            "price", price
        ));
    }
    
    /**
     * Get historical candles
     */
    @GetMapping("/candles/{symbol}")
    public ResponseEntity<List<CandleData>> getHistoricalCandles(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1m") String timeframe,
            @RequestParam(defaultValue = "100") int count) {
        List<CandleData> candles = marketDataService.getHistoricalCandles(symbol, timeframe, count);
        return ResponseEntity.ok(candles);
    }
}
