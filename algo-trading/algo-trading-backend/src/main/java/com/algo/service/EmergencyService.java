package com.algo.service;

import com.algo.enums.EngineStatus;
import com.algo.model.EngineState;
import com.algo.model.Order;
import com.algo.model.Position;
import com.algo.repository.EngineStateRepository;
import com.algo.repository.OrderRepository;
import com.algo.repository.PositionRepository;
import com.algo.service.broker.BrokerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmergencyService {
    
    private final BrokerService brokerService;
    private final EngineStateRepository engineStateRepository;
    private final PositionRepository positionRepository;
    private final OrderRepository orderRepository;
    private final RiskManagementService riskManagementService;
    private final AuditService auditService;
    
    /**
     * EMERGENCY STOP - Cancels all orders, squares off all positions, stops engine
     * USE WITH EXTREME CAUTION
     */
    @Transactional
    public EmergencyStopResponse emergencyStop(Long userId, String triggeredBy) {
        log.error("========================================");
        log.error("🚨 EMERGENCY STOP TRIGGERED 🚨");
        log.error("User: {}, Triggered by: {}", userId, triggeredBy);
        log.error("========================================");
        
        EmergencyStopResponse response = new EmergencyStopResponse();
        response.setTimestamp(LocalDateTime.now());
        response.setTriggeredBy(triggeredBy);
        
        try {
            // 1. STOP ENGINE IMMEDIATELY
            EngineState engineState = engineStateRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("Engine state not found"));
            
            engineState.setStatus(EngineStatus.LOCKED);
            engineState.setLockReason("EMERGENCY STOP - " + triggeredBy);
            engineState.setUpdatedAt(LocalDateTime.now());
            engineStateRepository.save(engineState);
            
            response.setEngineStopped(true);
            log.error("[EMERGENCY] Engine stopped");
            
            // 2. CANCEL ALL PENDING ORDERS AT BROKER
            try {
                brokerService.cancelAllOrders();
                response.setOrdersCancelled(true);
                log.error("[EMERGENCY] All broker orders cancelled");
            } catch (Exception e) {
                log.error("[EMERGENCY] Failed to cancel broker orders", e);
                response.setOrdersCancelled(false);
                response.addError("Failed to cancel orders: " + e.getMessage());
            }
            
            // 3. SQUARE OFF ALL POSITIONS AT BROKER
            try {
                brokerService.squareOffAll();
                response.setPositionsSquaredOff(true);
                log.error("[EMERGENCY] All broker positions squared off");
            } catch (Exception e) {
                log.error("[EMERGENCY] Failed to square off positions", e);
                response.setPositionsSquaredOff(false);
                response.addError("Failed to square off: " + e.getMessage());
            }
            
            // 4. UPDATE LOCAL DATABASE POSITIONS
            List<Position> openPositions = positionRepository.findByUserIdAndStatus(
                    userId, com.algo.enums.PositionStatus.OPEN);
            
            for (Position position : openPositions) {
                try {
                    double currentPrice = brokerService.getCurrentPrice(position.getSymbol());
                    position.setCurrentPrice(currentPrice);
                    double pnl = (currentPrice - position.getEntryPrice()) * position.getQuantity();
                    position.setRealizedPnl(pnl);
                    position.setUnrealizedPnl(0.0);
                    position.setStatus(com.algo.enums.PositionStatus.CLOSED);
                    position.setClosedAt(LocalDateTime.now());
                    positionRepository.save(position);
                    
                    response.addClosedPosition(position.getSymbol(), pnl);
                } catch (Exception e) {
                    log.error("[EMERGENCY] Failed to close position {}", position.getSymbol(), e);
                }
            }
            
            // 5. LOCK RISK MANAGEMENT
            riskManagementService.lockEngine(userId, "EMERGENCY STOP");
            response.setRiskLocked(true);
            log.error("[EMERGENCY] Risk management locked");
            
            // 6. AUDIT LOG
            auditService.logEmergencyStop(userId, triggeredBy);
            
            log.error("========================================");
            log.error("🚨 EMERGENCY STOP COMPLETED 🚨");
            log.error("Positions closed: {}", response.getClosedPositions().size());
            log.error("========================================");
            
            response.setSuccess(true);
            return response;
            
        } catch (Exception e) {
            log.error("[EMERGENCY] Emergency stop failed", e);
            response.setSuccess(false);
            response.addError("Emergency stop failed: " + e.getMessage());
            return response;
        }
    }
    
    /**
     * Reset after emergency - requires manual confirmation
     */
    @Transactional
    public void resetAfterEmergency(Long userId) {
        log.warn("Resetting after emergency for user {}", userId);
        
        EngineState engineState = engineStateRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Engine state not found"));
        
        engineState.setStatus(EngineStatus.STOPPED);
        engineState.setLockReason(null);
        engineState.setUpdatedAt(LocalDateTime.now());
        engineStateRepository.save(engineState);
        
        riskManagementService.unlockEngine(userId);
        
        log.info("Emergency reset completed for user {}", userId);
    }
    
    public static class EmergencyStopResponse {
        private boolean success;
        private LocalDateTime timestamp;
        private String triggeredBy;
        private boolean engineStopped;
        private boolean ordersCancelled;
        private boolean positionsSquaredOff;
        private boolean riskLocked;
        private List<PositionClosed> closedPositions = new java.util.ArrayList<>();
        private List<String> errors = new java.util.ArrayList<>();
        
        public void addClosedPosition(String symbol, double pnl) {
            closedPositions.add(new PositionClosed(symbol, pnl));
        }
        
        public void addError(String error) {
            errors.add(error);
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
        public String getTriggeredBy() { return triggeredBy; }
        public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }
        public boolean isEngineStopped() { return engineStopped; }
        public void setEngineStopped(boolean engineStopped) { this.engineStopped = engineStopped; }
        public boolean isOrdersCancelled() { return ordersCancelled; }
        public void setOrdersCancelled(boolean ordersCancelled) { this.ordersCancelled = ordersCancelled; }
        public boolean isPositionsSquaredOff() { return positionsSquaredOff; }
        public void setPositionsSquaredOff(boolean positionsSquaredOff) { this.positionsSquaredOff = positionsSquaredOff; }
        public boolean isRiskLocked() { return riskLocked; }
        public void setRiskLocked(boolean riskLocked) { this.riskLocked = riskLocked; }
        public List<PositionClosed> getClosedPositions() { return closedPositions; }
        public List<String> getErrors() { return errors; }
        
        public static class PositionClosed {
            private String symbol;
            private double pnl;
            
            public PositionClosed(String symbol, double pnl) {
                this.symbol = symbol;
                this.pnl = pnl;
            }

            public String getSymbol() { return symbol; }
            public double getPnl() { return pnl; }
        }
    }
}
