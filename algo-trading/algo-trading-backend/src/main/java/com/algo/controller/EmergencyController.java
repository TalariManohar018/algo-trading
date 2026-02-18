package com.algo.controller;

import com.algo.config.BrokerConfig;
import com.algo.enums.BrokerMode;
import com.algo.model.AuditLog;
import com.algo.model.User;
import com.algo.service.AuditService;
import com.algo.service.EmergencyService;
import com.algo.service.broker.BrokerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/emergency")
@RequiredArgsConstructor
@Slf4j
public class EmergencyController {
    
    private final EmergencyService emergencyService;
    private final BrokerService brokerService;
    private final BrokerConfig brokerConfig;
    private final AuditService auditService;
    
    /**
     * EMERGENCY KILL SWITCH
     * Stops everything immediately - cancels orders, squares off positions
     */
    @PostMapping("/stop")
    public ResponseEntity<EmergencyService.EmergencyStopResponse> emergencyStop(
            @AuthenticationPrincipal User user) {
        
        log.error("🚨 EMERGENCY STOP requested by user {}", user.getId());
        
        EmergencyService.EmergencyStopResponse response = 
                emergencyService.emergencyStop(user.getId(), "User triggered");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Reset after emergency - manual confirmation required
     */
    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> resetAfterEmergency(
            @AuthenticationPrincipal User user) {
        
        log.warn("Emergency reset requested by user {}", user.getId());
        
        emergencyService.resetAfterEmergency(user.getId());
        
        return ResponseEntity.ok(Map.of(
                "message", "Emergency reset completed. Engine is now STOPPED.",
                "note", "You can manually start the engine when ready."
        ));
    }
    
    /**
     * Get broker mode - PAPER or LIVE
     */
    @GetMapping("/broker-mode")
    public ResponseEntity<Map<String, Object>> getBrokerMode() {
        String mode = brokerConfig.getMode();
        String provider = brokerConfig.getProvider();
        boolean isLive = "LIVE".equalsIgnoreCase(mode);
        boolean isConnected = brokerService.isConnected();
        
        return ResponseEntity.ok(Map.of(
                "mode", mode,
                "provider", provider,
                "isLive", isLive,
                "isConnected", isConnected,
                "warning", isLive ? "⚠️ LIVE TRADING - REAL MONEY AT RISK ⚠️" : "Paper trading mode"
        ));
    }
    
    /**
     * Get audit logs
     */
    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs(@AuthenticationPrincipal User user) {
        List<AuditLog> logs = auditService.getUserLogs(user.getId());
        return ResponseEntity.ok(logs);
    }
    
    /**
     * Get critical audit logs (warnings and errors)
     */
    @GetMapping("/audit-logs/critical")
    public ResponseEntity<List<AuditLog>> getCriticalLogs(@AuthenticationPrincipal User user) {
        List<AuditLog> logs = auditService.getUserLogs(user.getId());
        List<AuditLog> criticalLogs = logs.stream()
                .filter(log -> "CRITICAL".equals(log.getSeverity()) || "WARNING".equals(log.getSeverity()))
                .toList();
        return ResponseEntity.ok(criticalLogs);
    }
}
