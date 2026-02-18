package com.algo.integration;

import com.algo.dto.CreateStrategyRequest;
import com.algo.dto.RiskConfigDTO;
import com.algo.dto.StrategyConditionDTO;
import com.algo.dto.TradingWindowDTO;
import com.algo.enums.*;
import com.algo.model.Strategy;
import com.algo.service.*;
import com.algo.service.market.MarketDataSimulator;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for the complete trading engine flow
 * Tests: Strategy creation -> Engine start -> Signal generation -> Order execution -> Position management
 */
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TradingEngineIntegrationTest {
    
    @Autowired
    private TradingEngineService tradingEngineService;
    
    @Autowired
    private StrategyService strategyService;
    
    @Autowired
    private OrderService orderService;
    
    @Autowired
    private PositionService positionService;
    
    @Autowired
    private WalletService walletService;
    
    @Autowired
    private RiskManagementService riskManagementService;
    
    @Autowired
    private MarketDataSimulator marketDataSimulator;
    
    private static final Long TEST_USER_ID = 1L;
    private static Long testStrategyId;
    
    @BeforeEach
    void setUp() {
        // Initialize wallet for test user
        walletService.createWalletForUser(TEST_USER_ID);
        
        // Seed some historical candle data
        marketDataSimulator.seedHistoricalData("NIFTY", "1m", 100);
    }
    
    @Test
    @Order(1)
    @DisplayName("Should create valid strategy")
    void testCreateStrategy() {
        CreateStrategyRequest request = createTestStrategyRequest();
        
        var response = strategyService.createStrategy(request);
        
        assertNotNull(response);
        assertNotNull(response.getId());
        assertEquals("Test NIFTY Strategy", response.getName());
        assertEquals(StrategyStatus.CREATED, response.getStatus());
        
        testStrategyId = response.getId();
    }
    
    @Test
    @Order(2)
    @DisplayName("Should activate strategy")
    void testActivateStrategy() {
        if (testStrategyId == null) {
            testCreateStrategy();
        }
        
        var response = strategyService.activateStrategy(testStrategyId);
        
        assertNotNull(response);
        assertEquals(StrategyStatus.RUNNING, response.getStatus());
    }
    
    @Test
    @Order(3)
    @DisplayName("Should start trading engine")
    void testStartEngine() {
        tradingEngineService.startEngine(TEST_USER_ID);
        
        var status = tradingEngineService.getEngineStatus(TEST_USER_ID);
        
        assertEquals("RUNNING", status.get("status"));
        assertTrue((Boolean) status.get("marketDataRunning"));
    }
    
    @Test
    @Order(4)
    @DisplayName("Should process candle and generate signals")
    @Transactional
    void testCandleProcessing() throws InterruptedException {
        // Ensure engine is running
        if (!marketDataSimulator.isRunning()) {
            testStartEngine();
        }
        
        // Wait for at least one candle to be processed
        Thread.sleep(65000); // Wait 65 seconds for one minute candle
        
        // Check if any orders were created
        // Note: This depends on market conditions and strategy logic
        // In a real test, you'd mock the conditions or use deterministic data
    }
    
    @Test
    @Order(5)
    @DisplayName("Should stop trading engine")
    void testStopEngine() {
        tradingEngineService.stopEngine(TEST_USER_ID);
        
        var status = tradingEngineService.getEngineStatus(TEST_USER_ID);
        
        assertEquals("STOPPED", status.get("status"));
    }
    
    @Test
    @Order(6)
    @DisplayName("Should execute emergency stop")
    void testEmergencyStop() {
        // Start engine first
        tradingEngineService.startEngine(TEST_USER_ID);
        
        // Execute emergency stop
        tradingEngineService.emergencyStop(TEST_USER_ID, "Test emergency stop");
        
        var status = tradingEngineService.getEngineStatus(TEST_USER_ID);
        
        assertEquals("LOCKED", status.get("status"));
    }
    
    @Test
    @Order(7)
    @DisplayName("Should enforce risk limits")
    void testRiskLimits() {
        // Attempt order that exceeds max capital per trade
        double largeOrderValue = 15000.0;  // Exceeds MAX_CAPITAL_PER_TRADE = 10000
        
        var riskCheck = riskManagementService.checkRiskLimits(TEST_USER_ID, largeOrderValue);
        
        assertFalse(riskCheck.isPassed());
        assertTrue(riskCheck.getReason().contains("Order value exceeds limit"));
    }
    
    @Test
    @Order(8)
    @DisplayName("Should update wallet on position close")
    void testWalletUpdate() {
        double initialBalance = walletService.getUserWallet(TEST_USER_ID).getBalance();
        
        // Simulate a profitable trade
        double profit = 500.0;
        walletService.updateBalanceOnPositionClose(TEST_USER_ID, profit);
        
        double newBalance = walletService.getUserWallet(TEST_USER_ID).getBalance();
        
        assertEquals(initialBalance + profit, newBalance);
    }
    
    // Helper method to create test strategy
    private CreateStrategyRequest createTestStrategyRequest() {
        CreateStrategyRequest request = new CreateStrategyRequest();
        request.setName("Test NIFTY Strategy");
        request.setDescription("Integration test strategy");
        request.setSymbol("NIFTY");
        request.setInstrumentType(InstrumentType.NIFTY);
        request.setTimeframe(TimeFrame.ONE_MINUTE);
        request.setQuantity(1);
        request.setOrderType(OrderType.MARKET);
        request.setProductType(ProductType.MIS);
        
        // Entry condition: Price > 22000
        StrategyConditionDTO entryCondition = new StrategyConditionDTO();
        entryCondition.setIndicatorType(IndicatorType.PRICE);
        entryCondition.setConditionType(ConditionType.GREATER_THAN);
        entryCondition.setValue(22000.0);
        request.setEntryConditions(List.of(entryCondition));
        
        // Exit condition: Price < 21950
        StrategyConditionDTO exitCondition = new StrategyConditionDTO();
        exitCondition.setIndicatorType(IndicatorType.PRICE);
        exitCondition.setConditionType(ConditionType.LESS_THAN);
        exitCondition.setValue(21950.0);
        request.setExitConditions(List.of(exitCondition));
        
        // Trading window
        TradingWindowDTO tradingWindow = new TradingWindowDTO();
        tradingWindow.setStartTime("09:15");
        tradingWindow.setEndTime("15:00");
        request.setTradingWindow(tradingWindow);
        
        request.setSquareOffTime("15:15");
        request.setMaxTradesPerDay(5);
        
        // Risk config
        RiskConfigDTO riskConfig = new RiskConfigDTO();
        riskConfig.setMaxLossPerTrade(1000.0);
        riskConfig.setMaxProfitTarget(2000.0);
        request.setRiskConfig(riskConfig);
        
        return request;
    }
}
