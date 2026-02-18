package com.algo.service.market;

import com.algo.dto.CandleData;
import com.algo.model.Candle;
import com.algo.repository.CandleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Market Data Simulator
 * Generates realistic 1-minute candles with volatility
 * Stores candles in database for historical replay
 */
@Service
@Primary
@RequiredArgsConstructor
@Slf4j
public class MarketDataSimulator implements MarketDataService {
    
    private final CandleRepository candleRepository;
    
    private final List<Consumer<CandleData>> candleListeners = new CopyOnWriteArrayList<>();
    private final Map<String, Double> currentPrices = new ConcurrentHashMap<>();
    private final Map<String, Double> baseVolatility = new ConcurrentHashMap<>();
    
    private volatile boolean running = false;
    
    // Base prices for common symbols
    private static final Map<String, Double> BASE_PRICES = Map.of(
        "NIFTY", 22000.0,
        "BANKNIFTY", 46000.0,
        "FINNIFTY", 20000.0,
        "SENSEX", 72000.0
    );
    
    // Volatility settings
    private static final double DEFAULT_VOLATILITY = 0.002; // 0.2% per minute
    private static final Random random = new Random();
    
    @Override
    public void start() {
        if (running) {
            log.warn("Market data simulator is already running");
            return;
        }
        
        log.info("Starting market data simulator");
        running = true;
        
        // Initialize prices for all base symbols
        BASE_PRICES.forEach((symbol, basePrice) -> {
            currentPrices.putIfAbsent(symbol, basePrice);
            baseVolatility.putIfAbsent(symbol, DEFAULT_VOLATILITY);
        });
    }
    
    @Override
    public void stop() {
        if (!running) {
            return;
        }
        
        log.info("Stopping market data simulator");
        running = false;
    }
    
    @Override
    public boolean isRunning() {
        return running;
    }
    
    @Override
    public void subscribeToCandleClose(Consumer<CandleData> listener) {
        candleListeners.add(listener);
        log.info("New candle listener subscribed. Total listeners: {}", candleListeners.size());
    }
    
    @Override
    public void unsubscribeFromCandleClose(Consumer<CandleData> listener) {
        candleListeners.remove(listener);
        log.info("Candle listener unsubscribed. Total listeners: {}", candleListeners.size());
    }
    
    @Override
    public Double getCurrentPrice(String symbol) {
        return currentPrices.getOrDefault(symbol, BASE_PRICES.getOrDefault(symbol, 20000.0));
    }
    
    @Override
    public List<CandleData> getHistoricalCandles(String symbol, String timeframe, int count) {
        List<Candle> candles = candleRepository.findBySymbolAndTimeframeOrderByTimestampDesc(symbol, timeframe);
        
        return candles.stream()
            .limit(count)
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }
    
    /**
     * Generate candles every minute at the start of the minute
     * Executes at 0 seconds of every minute
     */
    @Scheduled(cron = "0 * * * * *")
    public void generateMinuteCandles() {
        if (!running) {
            return;
        }
        
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        
        // Generate candles for all tracked symbols
        currentPrices.keySet().forEach(symbol -> {
            try {
                CandleData candle = generateCandle(symbol, "1m", now);
                
                // Save to database
                saveCandle(candle);
                
                // Emit to all listeners
                emitCandleClose(candle);
                
            } catch (Exception e) {
                log.error("Error generating candle for symbol {}: {}", symbol, e.getMessage());
            }
        });
    }
    
    /**
     * Generate a single candle with realistic OHLCV data
     */
    private CandleData generateCandle(String symbol, String timeframe, LocalDateTime timestamp) {
        Double currentPrice = currentPrices.getOrDefault(symbol, BASE_PRICES.getOrDefault(symbol, 20000.0));
        Double volatility = baseVolatility.getOrDefault(symbol, DEFAULT_VOLATILITY);
        
        // Generate realistic price movement
        double changePercent = (random.nextDouble() - 0.5) * 2 * volatility;
        double open = currentPrice;
        double close = open * (1 + changePercent);
        
        // Generate high/low with realistic spread
        double highLowRange = Math.abs(close - open) * (1.5 + random.nextDouble() * 0.5);
        double high = Math.max(open, close) + highLowRange * random.nextDouble();
        double low = Math.min(open, close) - highLowRange * random.nextDouble();
        
        // Generate volume (random between 1000 and 10000)
        long volume = 1000 + random.nextInt(9000);
        
        // Update current price for next candle
        currentPrices.put(symbol, close);
        
        return new CandleData(symbol, timeframe, timestamp, open, high, low, close, volume);
    }
    
    /**
     * Save candle to database
     */
    private void saveCandle(CandleData candleData) {
        Candle candle = new Candle();
        candle.setSymbol(candleData.getSymbol());
        candle.setTimeframe(candleData.getTimeframe());
        candle.setTimestamp(candleData.getTimestamp());
        candle.setOpen(candleData.getOpen());
        candle.setHigh(candleData.getHigh());
        candle.setLow(candleData.getLow());
        candle.setClose(candleData.getClose());
        candle.setVolume(candleData.getVolume());
        
        candleRepository.save(candle);
    }
    
    /**
     * Emit candle-close event to all listeners
     */
    private void emitCandleClose(CandleData candle) {
        log.debug("Emitting candle close: {} {} @ {}", candle.getSymbol(), candle.getTimeframe(), candle.getClose());
        
        for (Consumer<CandleData> listener : candleListeners) {
            try {
                listener.accept(candle);
            } catch (Exception e) {
                log.error("Error notifying candle listener: {}", e.getMessage());
            }
        }
    }
    
    /**
     * Convert entity to DTO
     */
    private CandleData convertToDTO(Candle candle) {
        return new CandleData(
            candle.getSymbol(),
            candle.getTimeframe(),
            candle.getTimestamp(),
            candle.getOpen(),
            candle.getHigh(),
            candle.getLow(),
            candle.getClose(),
            candle.getVolume()
        );
    }
    
    /**
     * Seed historical data for testing/backtesting
     */
    public void seedHistoricalData(String symbol, String timeframe, int candleCount) {
        log.info("Seeding {} historical candles for {} {}", candleCount, symbol, timeframe);
        
        LocalDateTime startTime = LocalDateTime.now().minusMinutes(candleCount);
        Double basePrice = BASE_PRICES.getOrDefault(symbol, 20000.0);
        currentPrices.put(symbol, basePrice);
        
        for (int i = 0; i < candleCount; i++) {
            LocalDateTime timestamp = startTime.plusMinutes(i);
            CandleData candle = generateCandle(symbol, timeframe, timestamp);
            saveCandle(candle);
        }
        
        log.info("Seeded {} candles successfully", candleCount);
    }
}
