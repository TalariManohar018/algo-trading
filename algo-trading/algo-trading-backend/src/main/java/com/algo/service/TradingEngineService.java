package com.algo.service;

import com.algo.dto.CandleData;
import com.algo.enums.EngineStatus;
import com.algo.enums.OrderSide;
import com.algo.enums.OrderStatus;
import com.algo.enums.OrderType;
import com.algo.enums.StrategyStatus;
import com.algo.model.*;
import com.algo.repository.*;
import com.algo.service.broker.BrokerService;
import com.algo.service.broker.OrderStatusResponse;
import com.algo.service.engine.StrategyEvaluator;
import com.algo.service.market.MarketDataService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Trading Engine Service
 * Candle-driven trading engine that evaluates strategies on each candle close
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TradingEngineService {
    
    private final MarketDataService marketDataService;
    private final StrategyService strategyService;
    private final StrategyEvaluator strategyEvaluator;
    private final OrderRepository orderRepository;
    private final PositionRepository positionRepository;
    private final BrokerService brokerService;
    private final WalletService walletService;
    private final RiskManagementService riskManagementService;
    private final AuditService auditService;
    private final EngineStateRepository engineStateRepository;
    
    private final Map<Long, Integer> dailyTradeCount = new HashMap<>();
    private volatile EngineStatus engineStatus = EngineStatus.STOPPED;
    private volatile Long currentUserId = null;
    
    /**
     * Start the trading engine
     */
    @Transactional
    public void startEngine(Long userId) {
        if (engineStatus == EngineStatus.RUNNING) {
            throw new IllegalStateException("Engine is already running");
        }
        
        // Check risk locks
        RiskState riskState = riskManagementService.getRiskState(userId);
        if (riskState != null && riskState.getIsLocked()) {
            throw new IllegalStateException("Risk locked: " + riskState.getLockReason());
        }
        
        log.info("Starting trading engine for user {}", userId);
        
        currentUserId = userId;
        engineStatus = EngineStatus.RUNNING;
        
        // Start market data service
        if (!marketDataService.isRunning()) {
            marketDataService.start();
        }
        
        // Subscribe to candle-close events
        marketDataService.subscribeToCandleClose(this::onCandleClose);
        
        // Update engine state in database
        EngineState engineState = engineStateRepository.findByUserId(userId)
                .orElse(new EngineState());
        engineState.setUserId(userId);
        engineState.setStatus(EngineStatus.RUNNING);
        engineState.setUpdatedAt(LocalDateTime.now());
        engineStateRepository.save(engineState);
        
        auditService.logInfo(userId, "TRADING_ENGINE", "Engine started", null);
        
        log.info("✅ Trading engine started successfully");
    }
    
    /**
     * Stop the trading engine
     */
    @Transactional
    public void stopEngine(Long userId) {
        if (engineStatus == EngineStatus.STOPPED) {
            log.warn("Engine is already stopped");
            return;
        }
        
        log.info("Stopping trading engine for user {}", userId);
        
        engineStatus = EngineStatus.STOPPED;
        currentUserId = null;
        
        // Update engine state in database
        engineStateRepository.findByUserId(userId).ifPresent(engineState -> {
            engineState.setStatus(EngineStatus.STOPPED);
            engineState.setUpdatedAt(LocalDateTime.now());
            engineStateRepository.save(engineState);
        });
        
        auditService.logInfo(userId, "TRADING_ENGINE", "Engine stopped", null);
        
        log.info("✅ Trading engine stopped");
    }
    
    /**
     * Emergency stop - closes all positions and locks engine
     */
    @Transactional
    public void emergencyStop(Long userId, String reason) {
        log.warn("🚨 EMERGENCY STOP initiated: {}", reason);
        
        engineStatus = EngineStatus.LOCKED;
        
        // Square off all open positions
        List<Position> openPositions = positionRepository.findByUserIdAndStatus(
                userId, com.algo.enums.PositionStatus.OPEN);
        
        for (Position position : openPositions) {
            try {
                double currentPrice = marketDataService.getCurrentPrice(position.getSymbol());
                closePosition(userId, position, currentPrice, "EMERGENCY_STOP");
            } catch (Exception e) {
                log.error("Error closing position during emergency stop: {}", e.getMessage());
            }
        }
        
        // Update engine state
        engineStateRepository.findByUserId(userId).ifPresent(engineState -> {
            engineState.setStatus(EngineStatus.LOCKED);
            engineState.setLockReason(reason);
            engineState.setUpdatedAt(LocalDateTime.now());
            engineStateRepository.save(engineState);
        });
        
        auditService.logCritical(userId, "TRADING_ENGINE", "Emergency stop: " + reason, null);
        
        log.warn("🚨 Emergency stop completed. Squared off {} positions", openPositions.size());
    }
    
    /**
     * Get current engine status
     */
    public Map<String, Object> getEngineStatus(Long userId) {
        EngineState engineState = engineStateRepository.findByUserId(userId).orElse(null);
        
        Map<String, Object> status = new HashMap<>();
        status.put("status", engineStatus.name());
        status.put("userId", currentUserId);
        status.put("marketDataRunning", marketDataService.isRunning());
        
        if (engineState != null) {
            status.put("lastTickAt", engineState.getLastTickAt());
            status.put("lockReason", engineState.getLockReason());
        }
        
        // Count running strategies
        List<Strategy> runningStrategies = strategyService.getRunningStrategies();
        status.put("runningStrategiesCount", runningStrategies.size());
        
        // Count open positions
        List<Position> openPositions = positionRepository.findByUserIdAndStatus(
                userId, com.algo.enums.PositionStatus.OPEN);
        status.put("openPositionsCount", openPositions.size());
        
        return status;
    }
    
    /**
     * Candle-close event handler
     * This is called by MarketDataService on every minute candle close
     */
    @Transactional
    public void onCandleClose(CandleData candle) {
        if (engineStatus != EngineStatus.RUNNING || currentUserId == null) {
            return;
        }
        
        try {
            log.debug("Processing candle close: {} @ {}", candle.getSymbol(), candle.getClose());
            
            // Check market hours and trading window
            if (!isWithinTradingHours()) {
                log.debug("Outside trading hours, skipping evaluation");
                return;
            }
            
            // Get all running strategies that match this symbol
            List<Strategy> runningStrategies = strategyService.getRunningStrategies().stream()
                    .filter(s -> s.getSymbol().equals(candle.getSymbol()))
                    .toList();
            
            // Evaluate each strategy
            for (Strategy strategy : runningStrategies) {
                evaluateStrategy(currentUserId, strategy, candle);
            }
            
            // Update last tick time
            engineStateRepository.findByUserId(currentUserId).ifPresent(engineState -> {
                engineState.setLastTickAt(LocalDateTime.now());
                engineStateRepository.save(engineState);
            });
            
        } catch (Exception e) {
            log.error("Error processing candle close: {}", e.getMessage(), e);
            auditService.logError(currentUserId, "TRADING_ENGINE", 
                    "Error processing candle: " + e.getMessage(), null);
        }
    }
    
    /**
     * Evaluate a strategy against current market data
     */
    private void evaluateStrategy(Long userId, Strategy strategy, CandleData candle) {
        try {
            // Check trading window
            if (!isWithinStrategyTradingWindow(strategy)) {
                log.debug("Strategy {} outside trading window", strategy.getName());
                return;
            }
            
            // Check square-off time
            if (isPastSquareOffTime(strategy)) {
                squareOffStrategyPositions(userId, strategy);
                return;
            }
            
            // Check if position exists for this strategy
            List<Position> openPositions = positionRepository
                    .findByUserIdAndStrategyIdAndStatus(userId, strategy.getId(), 
                            com.algo.enums.PositionStatus.OPEN);
            
            boolean hasOpenPosition = !openPositions.isEmpty();
            
            if (hasOpenPosition) {
                // Update unrealized P&L
                for (Position position : openPositions) {
                    updateUnrealizedPnL(position, candle.getClose());
                }
                
                // Evaluate exit conditions
                if (strategyEvaluator.evaluateExitConditions(strategy.getExitConditions(), candle)) {
                    log.info("✅ EXIT signal for strategy {} at {}", strategy.getName(), candle.getClose());
                    auditService.logInfo(userId, "SIGNAL", 
                            "EXIT signal for " + strategy.getName(), Map.of("price", candle.getClose()));
                    
                    for (Position position : openPositions) {
                        exitPosition(userId, strategy, position, candle.getClose());
                    }
                }
            } else {
                // Check daily trade limit
                int tradeCount = dailyTradeCount.getOrDefault(strategy.getId(), 0);
                if (tradeCount >= strategy.getMaxTradesPerDay()) {
                    log.debug("Strategy {} reached daily trade limit", strategy.getName());
                    return;
                }
                
                // Evaluate entry conditions
                if (strategyEvaluator.evaluateEntryConditions(strategy.getEntryConditions(), candle)) {
                    log.info("✅ ENTRY signal for strategy {} at {}", strategy.getName(), candle.getClose());
                    auditService.logInfo(userId, "SIGNAL", 
                            "ENTRY signal for " + strategy.getName(), Map.of("price", candle.getClose()));
                    
                    enterPosition(userId, strategy, candle.getClose());
                }
            }
            
        } catch (Exception e) {
            log.error("Error evaluating strategy {}: {}", strategy.getName(), e.getMessage(), e);
        }
    }
    
    /**
     * Enter a new position
     */
    private void enterPosition(Long userId, Strategy strategy, double currentPrice) {
        try {
            // Check risk limits before placing order
            double orderValue = strategy.getQuantity() * currentPrice;
            RiskManagementService.RiskCheckResult riskCheck = riskManagementService.checkRiskLimits(userId, orderValue);
            if (!riskCheck.isPassed()) {
                log.warn("Risk check failed for strategy {}: {}", strategy.getName(), riskCheck.getReason());
                auditService.logWarning(userId, "RISK", "Trade blocked by risk limits: " + riskCheck.getReason(), null);
                return;
            }
            
            // Create order
            Order order = Order.builder()
                    .userId(userId)
                    .strategyId(strategy.getId())
                    .strategyName(strategy.getName())
                    .symbol(strategy.getSymbol())
                    .side(OrderSide.BUY)
                    .quantity(strategy.getQuantity())
                    .orderType(strategy.getOrderType())
                    .status(OrderStatus.CREATED)
                    .createdAt(LocalDateTime.now())
                    .build();
            
            order = orderRepository.save(order);
            
            auditService.logInfo(userId, "ORDER", "Order created: " + order.getSymbol(), 
                    Map.of("orderId", order.getId(), "side", "BUY", "quantity", strategy.getQuantity()));
            
            // Place order with broker
            String brokerOrderId = brokerService.placeOrder(order);
            order.setStatus(OrderStatus.PLACED);
            order.setPlacedAt(LocalDateTime.now());
            order.setPlacedPrice(currentPrice);
            order = orderRepository.save(order);
            
            // Check order status
            OrderStatusResponse brokerStatus = brokerService.getOrderStatus(brokerOrderId);
            
            if (brokerStatus.getStatus() == OrderStatus.FILLED) {
                order.setStatus(OrderStatus.FILLED);
                order.setFilledPrice(brokerStatus.getFilledPrice());
                order.setFilledAt(LocalDateTime.now());
                orderRepository.save(order);
                
                auditService.logInfo(userId, "ORDER", "Order filled: " + order.getSymbol(), 
                        Map.of("orderId", order.getId(), "price", brokerStatus.getFilledPrice()));
                
                // Create position
                createPosition(userId, strategy, order, brokerStatus.getFilledPrice());
                
                // Increment trade count
                dailyTradeCount.put(strategy.getId(), 
                        dailyTradeCount.getOrDefault(strategy.getId(), 0) + 1);
                
                // Update risk state
                riskManagementService.updateAfterTrade(userId, 0.0);  // Entry, no P&L yet
                
            } else if (brokerStatus.getStatus() == OrderStatus.REJECTED) {
                order.setStatus(OrderStatus.REJECTED);
                order.setRejectedReason(brokerStatus.getMessage());
                orderRepository.save(order);
                
                auditService.logWarning(userId, "ORDER", "Order rejected: " + brokerStatus.getMessage(), 
                        Map.of("orderId", order.getId()));
            }
            
        } catch (Exception e) {
            log.error("Error entering position: {}", e.getMessage(), e);
            auditService.logError(userId, "ORDER", "Error placing order: " + e.getMessage(), null);
        }
    }
    
    /**
     * Exit an existing position
     */
    private void exitPosition(Long userId, Strategy strategy, Position position, double currentPrice) {
        try {
            // Create sell order
            Order order = Order.builder()
                    .userId(userId)
                    .strategyId(strategy.getId())
                    .strategyName(strategy.getName())
                    .symbol(strategy.getSymbol())
                    .side(OrderSide.SELL)
                    .quantity(position.getQuantity())
                    .orderType(OrderType.MARKET)
                    .status(OrderStatus.CREATED)
                    .createdAt(LocalDateTime.now())
                    .build();
            
            order = orderRepository.save(order);
            
            // Place order with broker
            String brokerOrderId = brokerService.placeOrder(order);
            order.setStatus(OrderStatus.PLACED);
            order.setPlacedAt(LocalDateTime.now());
            order.setPlacedPrice(currentPrice);
            order = orderRepository.save(order);
            
            // Check order status
            OrderStatusResponse brokerStatus = brokerService.getOrderStatus(brokerOrderId);
            
            if (brokerStatus.getStatus() == OrderStatus.FILLED) {
                order.setStatus(OrderStatus.FILLED);
                order.setFilledPrice(brokerStatus.getFilledPrice());
                order.setFilledAt(LocalDateTime.now());
                orderRepository.save(order);
                
                // Close position
                closePosition(userId, position, brokerStatus.getFilledPrice(), "EXIT_SIGNAL");
            }
            
        } catch (Exception e) {
            log.error("Error exiting position: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Create a new position
     */
    private void createPosition(Long userId, Strategy strategy, Order order, double entryPrice) {
        Position position = new Position();
        position.setUserId(userId);
        position.setStrategyId(strategy.getId());
        position.setStrategyName(strategy.getName());
        position.setSymbol(order.getSymbol());
        position.setSide(com.algo.enums.PositionSide.LONG);
        position.setQuantity(order.getQuantity());
        position.setEntryPrice(entryPrice);
        position.setCurrentPrice(entryPrice);
        position.setUnrealizedPnl(0.0);
        position.setRealizedPnl(0.0);
        position.setStatus(com.algo.enums.PositionStatus.OPEN);
        position.setOpenedAt(LocalDateTime.now());
        
        positionRepository.save(position);
        
        auditService.logInfo(userId, "POSITION", "Position opened: " + order.getSymbol(), 
                Map.of("quantity", order.getQuantity(), "entryPrice", entryPrice));
        
        log.info("Position created: {} x {} @ {}", order.getSymbol(), order.getQuantity(), entryPrice);
    }
    
    /**
     * Close a position
     */
    private void closePosition(Long userId, Position position, double exitPrice, String reason) {
        position.setCurrentPrice(exitPrice);
        double pnl = (exitPrice - position.getEntryPrice()) * position.getQuantity();
        position.setRealizedPnl(pnl);
        position.setUnrealizedPnl(0.0);
        position.setStatus(com.algo.enums.PositionStatus.CLOSED);
        position.setClosedAt(LocalDateTime.now());
        
        positionRepository.save(position);
        
        // Update wallet
        walletService.updateBalanceOnPositionClose(userId, pnl);
        
        // Update risk state
        riskManagementService.updateAfterTrade(userId, pnl);
        
        auditService.logInfo(userId, "POSITION", "Position closed: " + position.getSymbol(), 
                Map.of("exitPrice", exitPrice, "pnl", pnl, "reason", reason));
        
        log.info("Position closed: {} @ {} | P&L: ₹{}", position.getSymbol(), exitPrice, pnl);
    }
    
    /**
     * Update unrealized P&L for a position
     */
    private void updateUnrealizedPnL(Position position, double currentPrice) {
        position.setCurrentPrice(currentPrice);
        double unrealizedPnl = (currentPrice - position.getEntryPrice()) * position.getQuantity();
        position.setUnrealizedPnl(unrealizedPnl);
        positionRepository.save(position);
    }
    
    /**
     * Square off all positions for a strategy at end of day
     */
    private void squareOffStrategyPositions(Long userId, Strategy strategy) {
        List<Position> openPositions = positionRepository
                .findByUserIdAndStrategyIdAndStatus(userId, strategy.getId(), 
                        com.algo.enums.PositionStatus.OPEN);
        
        for (Position position : openPositions) {
            double currentPrice = marketDataService.getCurrentPrice(position.getSymbol());
            exitPosition(userId, strategy, position, currentPrice);
        }
        
        log.info("Squared off {} positions for strategy {} (square-off time reached)", 
                openPositions.size(), strategy.getName());
    }
    
    /**
     * Check if within general market trading hours
     */
    private boolean isWithinTradingHours() {
        LocalTime now = LocalTime.now();
        LocalTime marketOpen = LocalTime.of(9, 15);
        LocalTime marketClose = LocalTime.of(15, 30);
        return now.isAfter(marketOpen) && now.isBefore(marketClose);
    }
    
    /**
     * Check if within strategy-specific trading window
     */
    private boolean isWithinStrategyTradingWindow(Strategy strategy) {
        if (strategy.getTradingWindow() == null) {
            return true;
        }
        
        LocalTime now = LocalTime.now();
        return now.isAfter(strategy.getTradingWindow().getStartTime()) 
                && now.isBefore(strategy.getTradingWindow().getEndTime());
    }
    
    /**
     * Check if past strategy square-off time
     */
    private boolean isPastSquareOffTime(Strategy strategy) {
        if (strategy.getSquareOffTime() == null) {
            return false;
        }
        
        LocalTime now = LocalTime.now();
        return now.isAfter(strategy.getSquareOffTime());
    }
    
    /**
     * Reset daily counters
     */
    @Transactional
    public void resetDailyCounters() {
        dailyTradeCount.clear();
        log.info("🔄 Daily trade counters reset");
        auditService.logInfo(currentUserId, "SYSTEM", "Daily counters reset", null);
    }
}
