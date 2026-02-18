package com.algo.service;

import com.algo.model.RiskState;
import com.algo.repository.RiskStateRepository;
import com.algo.service.RiskManagementService.RiskCheckResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Unit tests for Risk Management Service
 */
@ExtendWith(MockitoExtension.class)
class RiskManagementServiceTest {
    
    @Mock
    private RiskStateRepository riskStateRepository;
    
    @Mock
    private AuditService auditService;
    
    @InjectMocks
    private RiskManagementService riskManagementService;
    
    private RiskState testRiskState;
    
    @BeforeEach
    void setUp() {
        testRiskState = RiskState.builder()
                .id(1L)
                .userId(1L)
                .dailyLoss(0.0)
                .dailyTradeCount(0)
                .isLocked(false)
                .tradingDate(LocalDate.now())
                .build();
    }
    
    @Test
    @DisplayName("Should allow order within risk limits")
    void testOrderWithinLimits() {
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        
        RiskCheckResult result = riskManagementService.checkRiskLimits(1L, 5000.0);
        
        assertTrue(result.isPassed());
        assertNull(result.getReason());
    }
    
    @Test
    @DisplayName("Should block order exceeding max capital per trade")
    void testOrderExceedingMaxCapital() {
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        
        RiskCheckResult result = riskManagementService.checkRiskLimits(1L, 15000.0);
        
        assertFalse(result.isPassed());
        assertTrue(result.getReason().contains("Order value exceeds limit"));
    }
    
    @Test
    @DisplayName("Should lock engine when daily loss limit breached")
    void testDailyLossLimitBreach() {
        testRiskState.setDailyLoss(5500.0);  // Exceeds MAX_LOSS_PER_DAY = 5000
        
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        when(riskStateRepository.save(any(RiskState.class))).thenReturn(testRiskState);
        
        RiskCheckResult result = riskManagementService.checkRiskLimits(1L, 1000.0);
        
        assertFalse(result.isPassed());
        assertTrue(result.getReason().contains("Daily loss limit breached"));
        
        verify(riskStateRepository, times(1)).save(testRiskState);
    }
    
    @Test
    @DisplayName("Should lock engine when daily trade limit breached")
    void testDailyTradeLimitBreach() {
        testRiskState.setDailyTradeCount(11);  // Exceeds MAX_TRADES_PER_DAY = 10
        
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        when(riskStateRepository.save(any(RiskState.class))).thenReturn(testRiskState);
        
        RiskCheckResult result = riskManagementService.checkRiskLimits(1L, 1000.0);
        
        assertFalse(result.isPassed());
        assertTrue(result.getReason().contains("Daily trade limit breached"));
    }
    
    @Test
    @DisplayName("Should block orders when risk is locked")
    void testLockedRiskState() {
        testRiskState.setIsLocked(true);
        testRiskState.setLockReason("Manual lock for testing");
        
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        
        RiskCheckResult result = riskManagementService.checkRiskLimits(1L, 1000.0);
        
        assertFalse(result.isPassed());
        assertTrue(result.getReason().contains("Risk limits locked"));
    }
    
    @Test
    @DisplayName("Should update risk state after trade")
    void testUpdateAfterTrade() {
        when(riskStateRepository.findByUserIdAndTradingDate(anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(testRiskState));
        when(riskStateRepository.save(any(RiskState.class))).thenReturn(testRiskState);
        
        double loss = -200.0;
        riskManagementService.updateAfterTrade(1L, loss);
        
        assertEquals(200.0, testRiskState.getDailyLoss());
        assertEquals(1, testRiskState.getDailyTradeCount());
        
        verify(riskStateRepository, times(1)).save(testRiskState);
    }
}
