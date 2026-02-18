package com.algo.service.market;

import com.algo.dto.CandleData;

import java.util.List;
import java.util.function.Consumer;

/**
 * Market Data Service Interface
 * Abstracts the source of market data (simulator or live feed)
 */
public interface MarketDataService {
    
    /**
     * Start emitting candles
     */
    void start();
    
    /**
     * Stop emitting candles
     */
    void stop();
    
    /**
     * Check if service is running
     */
    boolean isRunning();
    
    /**
     * Subscribe to candle-close events
     * @param listener Callback function to receive candle data
     */
    void subscribeToCandleClose(Consumer<CandleData> listener);
    
    /**
     * Unsubscribe from candle-close events
     */
    void unsubscribeFromCandleClose(Consumer<CandleData> listener);
    
    /**
     * Get current price for a symbol
     */
    Double getCurrentPrice(String symbol);
    
    /**
     * Get historical candles for a symbol
     */
    List<CandleData> getHistoricalCandles(String symbol, String timeframe, int count);
}
