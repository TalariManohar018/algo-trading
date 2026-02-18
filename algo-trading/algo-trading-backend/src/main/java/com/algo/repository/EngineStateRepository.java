package com.algo.repository;

import com.algo.model.EngineState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EngineStateRepository extends JpaRepository<EngineState, Long> {
    Optional<EngineState> findByUserId(Long userId);
}
