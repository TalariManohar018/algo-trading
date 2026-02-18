package com.algo.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long userId;
    
    @Column(nullable = false)
    private String eventType; // SIGNAL, ORDER_PLACED, ORDER_FILLED, POSITION_OPENED, POSITION_CLOSED, RISK_BREACH, ENGINE_STOPPED, EMERGENCY_STOP
    
    @Column(nullable = false)
    private String severity; // INFO, WARNING, ERROR, CRITICAL
    
    @Column(columnDefinition = "TEXT")
    private String message;
    
    @Column(columnDefinition = "TEXT")
    private String metadata; // JSON string with additional data
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp = LocalDateTime.now();
}
