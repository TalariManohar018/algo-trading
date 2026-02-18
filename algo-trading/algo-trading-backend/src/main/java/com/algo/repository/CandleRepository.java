package com.algo.repository;

import com.algo.model.Candle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CandleRepository extends JpaRepository<Candle, Long> {
    
    List<Candle> findBySymbolAndTimeframeOrderByTimestampDesc(String symbol, String timeframe);
    
    List<Candle> findBySymbolAndTimeframeAndTimestampBetweenOrderByTimestampAsc(
        String symbol, 
        String timeframe, 
        LocalDateTime startTime, 
        LocalDateTime endTime
    );
    
    Optional<Candle> findFirstBySymbolAndTimeframeOrderByTimestampDesc(String symbol, String timeframe);
    
    @Query("SELECT c FROM Candle c WHERE c.symbol = :symbol AND c.timeframe = :timeframe " +
           "AND c.timestamp >= :startTime ORDER BY c.timestamp ASC")
    List<Candle> findRecentCandles(
        @Param("symbol") String symbol,
        @Param("timeframe") String timeframe,
        @Param("startTime") LocalDateTime startTime
    );
}
