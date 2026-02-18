package com.algo.repository;

import com.algo.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByUserIdOrderByTimestampDesc(Long userId);
    List<AuditLog> findByUserIdAndTimestampBetweenOrderByTimestampDesc(Long userId, LocalDateTime start, LocalDateTime end);
    List<AuditLog> findByUserIdAndEventTypeOrderByTimestampDesc(Long userId, String eventType);
}
