package com.algo.repository;

import com.algo.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {
    
    List<Trade> findByStrategyId(Long strategyId);
    
    List<Trade> findByIsOpen(Boolean isOpen);
}
