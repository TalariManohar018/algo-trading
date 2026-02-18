package com.algo.repository;

import com.algo.enums.StrategyStatus;
import com.algo.model.Strategy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StrategyRepository extends JpaRepository<Strategy, Long> {
    
    List<Strategy> findByNameContainingIgnoreCase(String name);
    
    List<Strategy> findByStatus(StrategyStatus status);
}
