package com.algo.repository;

import com.algo.model.RiskState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface RiskStateRepository extends JpaRepository<RiskState, Long> {
    Optional<RiskState> findByUserId(Long userId);
    Optional<RiskState> findByUserIdAndTradingDate(Long userId, LocalDate tradingDate);
}
