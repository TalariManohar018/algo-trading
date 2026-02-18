package com.algo.controller;

import com.algo.service.TradingEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/engine")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EngineController {
    
    private final TradingEngineService tradingEngineService;
    
    /**
     * Start trading engine
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startEngine(@RequestParam(required = false, defaultValue = "1") Long userId) {
        try {
            tradingEngineService.startEngine(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Engine started successfully",
                "status", tradingEngineService.getEngineStatus(userId)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Stop trading engine
     */
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stopEngine(@RequestParam(required = false, defaultValue = "1") Long userId) {
        try {
            tradingEngineService.stopEngine(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Engine stopped successfully",
                "status", tradingEngineService.getEngineStatus(userId)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Emergency stop
     */
    @PostMapping("/emergency-stop")
    public ResponseEntity<Map<String, Object>> emergencyStop(
            @RequestParam(required = false, defaultValue = "1") Long userId,
            @RequestParam(required = false, defaultValue = "Manual emergency stop") String reason) {
        try {
            tradingEngineService.emergencyStop(userId, reason);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Emergency stop executed - All positions squared off",
                "reason", reason
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Get engine status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(@RequestParam(required = false, defaultValue = "1") Long userId) {
        Map<String, Object> status = tradingEngineService.getEngineStatus(userId);
        return ResponseEntity.ok(status);
    }
    
    /**
     * Reset daily counters
     */
    @PostMapping("/reset-counters")
    public ResponseEntity<Map<String, String>> resetCounters() {
        tradingEngineService.resetDailyCounters();
        return ResponseEntity.ok(Map.of(
            "success", "true",
            "message", "Daily counters reset"
        ));
    }
}
