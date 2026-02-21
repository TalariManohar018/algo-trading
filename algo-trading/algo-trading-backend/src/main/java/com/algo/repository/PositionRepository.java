package com.algo.repository;

import com.algo.enums.PositionStatus;
import com.algo.model.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PositionRepository extends JpaRepository<Position, Long> {
    List<Position> findByUserIdOrderByOpenedAtDesc(Long userId);
    List<Position> findByUserIdAndStatus(Long userId, PositionStatus status);
    List<Position> findByStrategyIdAndStatus(Long strategyId, PositionStatus status);
    List<Position> findByUserIdAndStrategyIdAndStatus(Long userId, Long strategyId, PositionStatus status);
    List<Position> findBySymbolAndStatus(String symbol, PositionStatus status);
    List<Position> findByUserIdAndSymbolAndStatus(Long userId, String symbol, PositionStatus status);
}
