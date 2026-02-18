package com.algo.service;

import com.algo.dto.CandleData;
import com.algo.enums.OrderStatus;
import com.algo.enums.PositionStatus;
import com.algo.model.Order;
import com.algo.model.Position;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * SSE (Server-Sent Events) Service
 * Provides real-time updates to frontend clients
 */
@Service
@Slf4j
public class SseService {
    
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService heartbeatScheduler;
    
    public SseService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        
        // Heartbeat to keep connections alive
        this.heartbeatScheduler = Executors.newScheduledThreadPool(1);
        this.heartbeatScheduler.scheduleAtFixedRate(this::sendHeartbeat, 15, 15, TimeUnit.SECONDS);
    }
    
    /**
     * Create new SSE emitter for a client
     */
    public SseEmitter createEmitter(String userId) {
        SseEmitter emitter = new SseEmitter(0L); // No timeout
        
        String key = "user_" + userId;
        emitters.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(emitter);
        
        log.info("SSE emitter created for user: {}", userId);
        
        emitter.onCompletion(() -> {
            log.info("SSE emitter completed for user: {}", userId);
            removeEmitter(key, emitter);
        });
        
        emitter.onTimeout(() -> {
            log.warn("SSE emitter timed out for user: {}", userId);
            removeEmitter(key, emitter);
        });
        
        emitter.onError(e -> {
            log.error("SSE emitter error for user: {}", userId, e);
            removeEmitter(key, emitter);
        });
        
        // Send initial connection message
        sendEvent(userId, "connected", Map.of("message", "Connected to real-time updates"));
        
        return emitter;
    }
    
    /**
     * Remove emitter from registry
     */
    private void removeEmitter(String key, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> userEmitters = emitters.get(key);
        if (userEmitters != null) {
            userEmitters.remove(emitter);
            if (userEmitters.isEmpty()) {
                emitters.remove(key);
            }
        }
    }
    
    /**
     * Send event to specific user
     */
    public void sendEvent(String userId, String event, Object data) {
        String key = "user_" + userId;
        CopyOnWriteArrayList<SseEmitter> userEmitters = emitters.get(key);
        
        if (userEmitters == null || userEmitters.isEmpty()) {
            return;
        }
        
        try {
            String json = objectMapper.writeValueAsString(data);
            
            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.send(SseEmitter.event()
                            .name(event)
                            .data(json));
                } catch (IOException e) {
                    log.error("Error sending SSE event to user {}: {}", userId, e.getMessage());
                    removeEmitter(key, emitter);
                }
            }
        } catch (JsonProcessingException e) {
            log.error("Error serializing SSE data: {}", e.getMessage());
        }
    }
    
    /**
     * Broadcast event to all connected users
     */
    public void broadcastEvent(String event, Object data) {
        emitters.keySet().forEach(key -> {
            String userId = key.replace("user_", "");
            sendEvent(userId, event, data);
        });
    }
    
    /**
     * Send heartbeat to all connected clients
     */
    private void sendHeartbeat() {
        emitters.forEach((key, userEmitters) -> {
            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("heartbeat")
                            .data("ping"));
                } catch (IOException e) {
                    log.error("Heartbeat failed for {}: {}", key, e.getMessage());
                    removeEmitter(key, emitter);
                }
            }
        });
    }
    
    /**
     * Notify engine status change
     */
    public void notifyEngineStatusChange(String userId, String status, Map<String, Object> details) {
        sendEvent(userId, "engine_status", Map.of(
                "status", status,
                "details", details,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Notify order update
     */
    public void notifyOrderUpdate(String userId, Order order, String action) {
        sendEvent(userId, "order_update", Map.of(
                "action", action,
                "order", order,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Notify position update
     */
    public void notifyPositionUpdate(String userId, Position position, String action) {
        sendEvent(userId, "position_update", Map.of(
                "action", action,
                "position", position,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Notify candle update
     */
    public void notifyCandleUpdate(String userId, CandleData candle) {
        sendEvent(userId, "candle_update", Map.of(
                "candle", candle,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Notify risk alert
     */
    public void notifyRiskAlert(String userId, String alert, String severity) {
        sendEvent(userId, "risk_alert", Map.of(
                "alert", alert,
                "severity", severity,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Notify wallet update
     */
    public void notifyWalletUpdate(String userId, Map<String, Object> walletData) {
        sendEvent(userId, "wallet_update", Map.of(
                "wallet", walletData,
                "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Get active connections count
     */
    public int getActiveConnectionsCount() {
        return emitters.values().stream()
                .mapToInt(CopyOnWriteArrayList::size)
                .sum();
    }
}
