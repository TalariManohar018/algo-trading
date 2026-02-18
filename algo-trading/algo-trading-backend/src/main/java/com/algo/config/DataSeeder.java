package com.algo.config;

import com.algo.enums.*;
import com.algo.model.*;
import com.algo.repository.*;
import com.algo.service.market.MarketDataSimulator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Seed data for development and testing
 * Only runs in 'dev' profile
 */
@Configuration
@Slf4j
@RequiredArgsConstructor
@Profile("dev")
public class DataSeeder {
    
    private final UserRepository userRepository;
    private final StrategyRepository strategyRepository;
    private final WalletRepository walletRepository;
    private final RiskStateRepository riskStateRepository;
    private final MarketDataSimulator marketDataSimulator;
    private final PasswordEncoder passwordEncoder;
    
    @Bean
    CommandLineRunner seedData() {
        return args -> {
            log.info("🌱 Seeding development data...");
            
            // Create test user
            User user = createTestUser();
            log.info("✅ Created test user: {} (ID: {})", user.getUsername(), user.getId());
            
            // Create wallet for user
            Wallet wallet = createWalletForUser(user.getId());
            log.info("✅ Created wallet with balance: ₹{}", wallet.getBalance());
            
            // Create sample strategies
            List<Strategy> strategies = createSampleStrategies(user.getId());
            log.info("✅ Created {} sample strategies", strategies.size());
            
            // Seed historical candle data
            seedHistoricalCandles();
            log.info("✅ Seeded historical candle data");
            
            log.info("🎉 Data seeding completed successfully!");
            log.info("📝 Login credentials: trader@algo.com / password123");
        };
    }
    
    private User createTestUser() {
        if (userRepository.findByEmail("trader@algo.com").isPresent()) {
            return userRepository.findByEmail("trader@algo.com").get();
        }
        
        User user = new User();
        user.setFullName("trader");
        user.setEmail("trader@algo.com");
        user.setPassword(passwordEncoder.encode("password123"));
        user.setEnabled(true);
        user.setCreatedAt(LocalDateTime.now());
        
        return userRepository.save(user);
    }
    
    private Wallet createWalletForUser(Long userId) {
        if (walletRepository.findByUserId(userId).isPresent()) {
            return walletRepository.findByUserId(userId).get();
        }
        
        Wallet wallet = Wallet.builder()
                .userId(userId)
                .balance(100000.0)  // Starting capital: ₹1,00,000
                .usedMargin(0.0)
                .availableMargin(100000.0)
                .realizedPnl(0.0)
                .unrealizedPnl(0.0)
                .updatedAt(LocalDateTime.now())
                .build();
        
        return walletRepository.save(wallet);
    }
    
    private List<Strategy> createSampleStrategies(Long userId) {
        List<Strategy> strategies = new ArrayList<>();
        
        // Strategy 1: NIFTY Breakout Strategy
        Strategy niftyBreakout = new Strategy();
        niftyBreakout.setName("NIFTY Breakout");
        niftyBreakout.setDescription("Buy NIFTY when price breaks above 22,100");
        niftyBreakout.setSymbol("NIFTY");
        niftyBreakout.setInstrumentType(InstrumentType.NIFTY);
        niftyBreakout.setTimeframe(TimeFrame.ONE_MINUTE);
        niftyBreakout.setQuantity(1);
        niftyBreakout.setOrderType(OrderType.MARKET);
        niftyBreakout.setProductType(ProductType.MIS);
        niftyBreakout.setMaxTradesPerDay(3);
        niftyBreakout.setStatus(StrategyStatus.CREATED);
        
        // Entry condition: Price > 22100
        StrategyCondition entryCondition1 = createCondition(
                IndicatorType.PRICE, ConditionType.GREATER_THAN, 22100.0, null
        );
        niftyBreakout.setEntryConditions(List.of(entryCondition1));
        
        // Exit condition: Price < 22000
        StrategyCondition exitCondition1 = createCondition(
                IndicatorType.PRICE, ConditionType.LESS_THAN, 22000.0, null
        );
        niftyBreakout.setExitConditions(List.of(exitCondition1));
        
        // Trading window
        TradingWindow tradingWindow1 = new TradingWindow();
        tradingWindow1.setStartTime(LocalTime.of(9, 30));
        tradingWindow1.setEndTime(LocalTime.of(15, 0));
        niftyBreakout.setTradingWindow(tradingWindow1);
        niftyBreakout.setSquareOffTime(LocalTime.of(15, 15));
        
        // Risk config
        RiskConfig riskConfig1 = new RiskConfig();
        riskConfig1.setMaxLossPerTrade(1000.0);
        riskConfig1.setMaxProfitTarget(2000.0);
        niftyBreakout.setRiskConfig(riskConfig1);
        
        strategies.add(strategyRepository.save(niftyBreakout));
        
        // Strategy 2: BANKNIFTY Range Trading
        Strategy bankniftyRange = new Strategy();
        bankniftyRange.setName("BANKNIFTY Range");
        bankniftyRange.setDescription("Trade BANKNIFTY in range");
        bankniftyRange.setSymbol("BANKNIFTY");
        bankniftyRange.setInstrumentType(InstrumentType.BANKNIFTY);
        bankniftyRange.setTimeframe(TimeFrame.FIVE_MINUTES);
        bankniftyRange.setQuantity(1);
        bankniftyRange.setOrderType(OrderType.MARKET);
        bankniftyRange.setProductType(ProductType.MIS);
        bankniftyRange.setMaxTradesPerDay(5);
        bankniftyRange.setStatus(StrategyStatus.CREATED);
        
        // Entry: Price < 45500
        StrategyCondition entryCondition2 = createCondition(
                IndicatorType.PRICE, ConditionType.LESS_THAN, 45500.0, null
        );
        bankniftyRange.setEntryConditions(List.of(entryCondition2));
        
        // Exit: Price > 46000
        StrategyCondition exitCondition2 = createCondition(
                IndicatorType.PRICE, ConditionType.GREATER_THAN, 46000.0, null
        );
        bankniftyRange.setExitConditions(List.of(exitCondition2));
        
        // Trading window
        TradingWindow tradingWindow2 = new TradingWindow();
        tradingWindow2.setStartTime(LocalTime.of(9, 30));
        tradingWindow2.setEndTime(LocalTime.of(14, 30));
        bankniftyRange.setTradingWindow(tradingWindow2);
        bankniftyRange.setSquareOffTime(LocalTime.of(15, 0));
        
        // Risk config
        RiskConfig riskConfig2 = new RiskConfig();
        riskConfig2.setMaxLossPerTrade(800.0);
        riskConfig2.setMaxProfitTarget(1500.0);
        bankniftyRange.setRiskConfig(riskConfig2);
        
        strategies.add(strategyRepository.save(bankniftyRange));
        
        return strategies;
    }
    
    private StrategyCondition createCondition(IndicatorType indicator, ConditionType condition, 
                                              Double value, ConditionLogic logic) {
        StrategyCondition sc = new StrategyCondition();
        sc.setIndicatorType(indicator);
        sc.setConditionType(condition);
        sc.setConditionValue(value);
        sc.setLogic(logic);
        return sc;
    }
    
    private void seedHistoricalCandles() {
        // Seed candle data for NIFTY
        marketDataSimulator.seedHistoricalData("NIFTY", "1m", 500);
        
        // Seed candle data for BANKNIFTY
        marketDataSimulator.seedHistoricalData("BANKNIFTY", "1m", 500);
        
        // Seed candle data for FINNIFTY
        marketDataSimulator.seedHistoricalData("FINNIFTY", "1m", 300);
    }
}
