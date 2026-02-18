package com.algo.util;

import com.algo.enums.InstrumentType;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

@Component
public class MockDataGenerator {
    
    private final Random random = new Random();
    
    /**
     * Generate mock candle data for backtesting
     */
    public List<CandleData> generateMockCandles(InstrumentType instrument, 
                                                  LocalDateTime startDate, 
                                                  LocalDateTime endDate) {
        List<CandleData> candles = new ArrayList<>();
        
        double basePrice = instrument == InstrumentType.NIFTY ? 21000.0 : 47000.0;
        LocalDateTime currentTime = startDate;
        
        while (currentTime.isBefore(endDate)) {
            // Generate realistic price movements
            double open = basePrice + (random.nextDouble() - 0.5) * 200;
            double close = open + (random.nextDouble() - 0.5) * 100;
            double high = Math.max(open, close) + random.nextDouble() * 50;
            double low = Math.min(open, close) - random.nextDouble() * 50;
            int volume = 50000 + random.nextInt(150000);
            
            candles.add(new CandleData(currentTime, open, high, low, close, volume));
            
            // Move to next 5-minute candle
            currentTime = currentTime.plusMinutes(5);
            basePrice = close; // Use previous close as base for next candle
        }
        
        return candles;
    }
    
    /**
     * Get current market price (mock)
     */
    public double getCurrentPrice(InstrumentType instrument) {
        if (instrument == InstrumentType.NIFTY) {
            return 21450.0 + (random.nextDouble() - 0.5) * 100;
        } else {
            return 47890.0 + (random.nextDouble() - 0.5) * 200;
        }
    }
    
    /**
     * Candle data structure
     */
    public static class CandleData {
        public LocalDateTime timestamp;
        public double open;
        public double high;
        public double low;
        public double close;
        public int volume;
        
        public CandleData(LocalDateTime timestamp, double open, double high, 
                         double low, double close, int volume) {
            this.timestamp = timestamp;
            this.open = open;
            this.high = high;
            this.low = low;
            this.close = close;
            this.volume = volume;
        }
    }
}
