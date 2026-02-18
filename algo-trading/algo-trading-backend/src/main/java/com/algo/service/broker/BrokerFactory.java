package com.algo.service.broker;

import com.algo.config.BrokerConfig;
import com.algo.enums.BrokerMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class BrokerFactory {
    
    private final BrokerConfig brokerConfig;
    private final MockBrokerService mockBrokerService;
    private final ZerodhaBrokerService zerodhaBrokerService;
    private final AngelBrokerService angelBrokerService;
    
    @Bean
    public BrokerService brokerService() {
        String mode = brokerConfig.getMode().toUpperCase();
        String provider = brokerConfig.getProvider().toUpperCase();
        
        if ("PAPER".equals(mode) || "MOCK".equals(provider)) {
            log.info("=".repeat(60));
            log.info("BROKER MODE: PAPER TRADING (MOCK)");
            log.info("=".repeat(60));
            return mockBrokerService;
        }
        
        if ("LIVE".equals(mode)) {
            log.warn("=".repeat(60));
            log.warn("⚠️  BROKER MODE: LIVE TRADING - REAL MONEY AT RISK ⚠️");
            log.warn("Provider: {}", provider);
            log.warn("=".repeat(60));
            
            return switch (provider) {
                case "ZERODHA" -> zerodhaBrokerService;
                case "ANGEL" -> angelBrokerService;
                default -> {
                    log.error("Unknown broker provider: {}. Falling back to MOCK.", provider);
                    yield mockBrokerService;
                }
            };
        }
        
        log.info("Defaulting to PAPER TRADING");
        return mockBrokerService;
    }
}
