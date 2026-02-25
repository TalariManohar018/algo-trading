package com.algo.controller;

import com.algo.dto.BrokerLoginRequest;
import com.algo.dto.BrokerStatusResponse;
import com.algo.service.broker.BrokerConnectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class HealthController {
    
    private final BrokerConnectionService brokerConnectionService;
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Algo Trading Backend");
        response.put("version", "1.0.0");
        response.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get current broker connection status
     */
    @GetMapping("/broker/status")
    public ResponseEntity<BrokerStatusResponse> brokerStatus() {
        log.debug("GET /api/broker/status");
        BrokerStatusResponse status = brokerConnectionService.getStatus();
        return ResponseEntity.ok(status);
    }
    
    /**
     * Connect to broker with credentials
     */
    @PostMapping("/broker/login")
    public ResponseEntity<BrokerStatusResponse> brokerLogin(@RequestBody BrokerLoginRequest request) {
        log.info("POST /api/broker/login - Attempting connection for client: {}", request.getClientId());
        BrokerStatusResponse response = brokerConnectionService.connect(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Disconnect from broker
     */
    @PostMapping("/broker/logout")
    public ResponseEntity<BrokerStatusResponse> brokerLogout() {
        log.info("POST /api/broker/logout");
        BrokerStatusResponse response = brokerConnectionService.disconnect();
        return ResponseEntity.ok(response);
    }
}
