package com.algo.service;

import com.algo.model.RiskState;
import com.algo.repository.RiskStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskManagementService {
    
    private final RiskStateRepository riskStateRepository;
    private final AuditService auditService;
    
    // Hard limits configuration
    private static final double MAX_LOSS_PER_DAY = 5000.0; // ₹5000
    private static final int MAX_TRADES_PER_DAY = 10;
    private static final double MAX_CAPITAL_PER_TRADE = 10000.0; // ₹10000
    private static final LocalTime MARKET_OPEN = LocalTime.of(9, 15);
    private static final LocalTime MARKET_CLOSE = LocalTime.of(15, 30);
    
    public RiskState getUserRiskState(Long userId) {
        LocalDate today = LocalDate.now();
        return riskStateRepository.findByUserIdAndTradingDate(userId, today)
                .orElseGet(() -> createRiskStateForUser(userId, today));
    }
    
    @Transactional
    public RiskState createRiskStateForUser(Long userId, LocalDate tradingDate) {
        RiskState riskState = RiskState.builder()
                .userId(userId)
                .dailyLoss(0.0)
                .dailyTradeCount(0)
                .isLocked(false)
                .tradingDate(tradingDate)
                .build();
        return riskStateRepository.save(riskState);
    }
    
    @Transactional
    public void updateOnTradeClosed(Long userId, Double pnl) {
        RiskState riskState = getUserRiskState(userId);
        
        if (pnl < 0) {
            riskState.setDailyLoss(riskState.getDailyLoss() + Math.abs(pnl));
        }
        
        riskState.setDailyTradeCount(riskState.getDailyTradeCount() + 1);
        riskState.setUpdatedAt(LocalDateTime.now());
        
        riskStateRepository.save(riskState);
    }
    
    /**
     * Check all risk limits before placing order - HARD ENFORCEMENT
     */
    @Transactional
    public RiskCheckResult checkRiskLimits(Long userId, double orderValue) {
        RiskState riskState = getUserRiskState(userId);
        
        // Check if already locked
        if (riskState.getIsLocked()) {
            return RiskCheckResult.failed("Risk limits locked: " + riskState.getLockReason());
        }
        
        // Check market hours
        if (!isMarketOpen()) {
            String reason = "Market is closed. Trading hours: 9:15 AM - 3:30 PM IST";
            return RiskCheckResult.failed(reason);
        }
        
        // Check daily loss limit
        if (riskState.getDailyLoss() >= MAX_LOSS_PER_DAY) {
            String reason = String.format("Daily loss limit breached: ₹%.2f / ₹%.2f", 
                    riskState.getDailyLoss(), MAX_LOSS_PER_DAY);
            lockEngine(userId, reason);
            auditService.logRiskBreach(userId, "DAILY_LOSS", riskState.getDailyLoss(), MAX_LOSS_PER_DAY);
            return RiskCheckResult.failed(reason);
        }
        
        // Check daily trade limit
        if (riskState.getDailyTradeCount() >= MAX_TRADES_PER_DAY) {
            String reason = String.format("Daily trade limit breached: %d / %d trades", 
                    riskState.getDailyTradeCount(), MAX_TRADES_PER_DAY);
            lockEngine(userId, reason);
            auditService.logRiskBreach(userId, "DAILY_TRADES", riskState.getDailyTradeCount(), MAX_TRADES_PER_DAY);
            return RiskCheckResult.failed(reason);
        }
        
        // Check max capital per trade
        if (orderValue > MAX_CAPITAL_PER_TRADE) {
            String reason = String.format("Order value exceeds limit: ₹%.2f / ₹%.2f", 
                    orderValue, MAX_CAPITAL_PER_TRADE);
            auditService.logRiskBreach(userId, "ORDER_SIZE", orderValue, MAX_CAPITAL_PER_TRADE);
            return RiskCheckResult.failed(reason);
        }
        
        return RiskCheckResult.passed();
    }
    
    /**
     * Check if market is open - Indian market hours
     */
    public boolean isMarketOpen() {
        LocalDateTime now = LocalDateTime.now();
        DayOfWeek day = now.getDayOfWeek();
        
        // Weekend check
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return false;
        }
        
        LocalTime currentTime = now.toLocalTime();
        return !currentTime.isBefore(MARKET_OPEN) && !currentTime.isAfter(MARKET_CLOSE);
    }
    
    @Transactional
    public void lockEngine(Long userId, String reason) {
        RiskState riskState = getUserRiskState(userId);
        riskState.setIsLocked(true);
        riskState.setLockReason(reason);
        riskState.setUpdatedAt(LocalDateTime.now());
        riskStateRepository.save(riskState);
        
        log.error("RISK ENGINE LOCKED for user {}: {}", userId, reason);
    }
    
    @Transactional
    public void unlockEngine(Long userId) {
        RiskState riskState = getUserRiskState(userId);
        riskState.setIsLocked(false);
        riskState.setLockReason(null);
        riskState.setUpdatedAt(LocalDateTime.now());
        riskStateRepository.save(riskState);
        
        log.info("Risk engine unlocked for user {}", userId);
    }
    
    @Transactional
    public void resetDailyLimits(Long userId) {
        RiskState riskState = getUserRiskState(userId);
        riskState.setDailyLoss(0.0);
        riskState.setDailyTradeCount(0);
        riskState.setUpdatedAt(LocalDateTime.now());
        riskStateRepository.save(riskState);
        
        log.info("Daily limits reset for user {}", userId);
    }
    
    public RiskState getRiskState(Long userId) {
        return getUserRiskState(userId);
    }
    
    @Transactional
    public void updateAfterTrade(Long userId, double pnl) {
        updateOnTradeClosed(userId, pnl);
    }
    
    public static class RiskCheckResult {
        private final boolean passed;
        private final String reason;
        
        private RiskCheckResult(boolean passed, String reason) {
            this.passed = passed;
            this.reason = reason;
        }
        
        public static RiskCheckResult passed() {
            return new RiskCheckResult(true, null);
        }
        
        public static RiskCheckResult failed(String reason) {
            return new RiskCheckResult(false, reason);
        }
        
        public boolean isPassed() {
            return passed;
        }
        
        public String getReason() {
            return reason;
        }
    }
}
