package com.algo.service;

import com.algo.model.AuditLog;
import com.algo.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {
    
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Transactional
    public void logEvent(Long userId, String eventType, String severity, String message, Map<String, Object> metadata) {
        try {
            String metadataJson = metadata != null ? objectMapper.writeValueAsString(metadata) : null;
            
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .eventType(eventType)
                    .severity(severity)
                    .message(message)
                    .metadata(metadataJson)
                    .timestamp(LocalDateTime.now())
                    .build();
            
            auditLogRepository.save(auditLog);
            log.info("[AUDIT] User={}, Event={}, Severity={}, Message={}", userId, eventType, severity, message);
        } catch (Exception e) {
            log.error("Failed to log audit event", e);
        }
    }
    
    public void logSignal(Long userId, Long strategyId, String strategyName, String signalType, double price) {
        logEvent(userId, "SIGNAL", "INFO", 
                String.format("Signal generated: %s for strategy %s at ₹%.2f", signalType, strategyName, price),
                Map.of("strategyId", strategyId, "strategyName", strategyName, "signalType", signalType, "price", price));
    }
    
    public void logOrderPlaced(Long userId, Long orderId, String symbol, String side, int quantity, double price) {
        logEvent(userId, "ORDER_PLACED", "INFO",
                String.format("Order placed: %s %d %s at ₹%.2f", side, quantity, symbol, price),
                Map.of("orderId", orderId, "symbol", symbol, "side", side, "quantity", quantity, "price", price));
    }
    
    public void logOrderFilled(Long userId, Long orderId, String symbol, double filledPrice) {
        logEvent(userId, "ORDER_FILLED", "INFO",
                String.format("Order filled: %s at ₹%.2f", symbol, filledPrice),
                Map.of("orderId", orderId, "symbol", symbol, "filledPrice", filledPrice));
    }
    
    public void logPositionOpened(Long userId, Long positionId, String symbol, int quantity, double entryPrice) {
        logEvent(userId, "POSITION_OPENED", "INFO",
                String.format("Position opened: %d %s at ₹%.2f", quantity, symbol, entryPrice),
                Map.of("positionId", positionId, "symbol", symbol, "quantity", quantity, "entryPrice", entryPrice));
    }
    
    public void logPositionClosed(Long userId, Long positionId, String symbol, double pnl) {
        logEvent(userId, "POSITION_CLOSED", "INFO",
                String.format("Position closed: %s with PnL ₹%.2f", symbol, pnl),
                Map.of("positionId", positionId, "symbol", symbol, "pnl", pnl));
    }
    
    public void logRiskBreach(Long userId, String breachType, Object currentValue, Object limitValue) {
        logEvent(userId, "RISK_BREACH", "CRITICAL",
                String.format("Risk limit breached: %s (Current: %s, Limit: %s)", breachType, currentValue, limitValue),
                Map.of("breachType", breachType, "currentValue", currentValue.toString(), "limitValue", limitValue.toString()));
    }
    
    public void logEngineStop(Long userId, String reason) {
        logEvent(userId, "ENGINE_STOPPED", "WARNING",
                String.format("Trading engine stopped: %s", reason),
                Map.of("reason", reason));
    }
    
    public void logEmergencyStop(Long userId, String triggeredBy) {
        logEvent(userId, "EMERGENCY_STOP", "CRITICAL",
                String.format("EMERGENCY STOP triggered by %s", triggeredBy),
                Map.of("triggeredBy", triggeredBy));
    }
    
    // Generic logging methods
    public void logInfo(Long userId, String eventType, String message, Map<String, Object> metadata) {
        logEvent(userId, eventType, "INFO", message, metadata);
    }
    
    public void logWarning(Long userId, String eventType, String message, Map<String, Object> metadata) {
        logEvent(userId, eventType, "WARNING", message, metadata);
    }
    
    public void logError(Long userId, String eventType, String message, Map<String, Object> metadata) {
        logEvent(userId, eventType, "ERROR", message, metadata);
    }
    
    public void logCritical(Long userId, String eventType, String message, Map<String, Object> metadata) {
        logEvent(userId, eventType, "CRITICAL", message, metadata);
    }
    
    public List<AuditLog> getUserLogs(Long userId) {
        return auditLogRepository.findByUserIdOrderByTimestampDesc(userId);
    }
    
    public List<AuditLog> getUserLogsByType(Long userId, String eventType) {
        return auditLogRepository.findByUserIdAndEventTypeOrderByTimestampDesc(userId, eventType);
    }
}
