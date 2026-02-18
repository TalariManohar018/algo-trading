package com.algo.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "broker")
@Data
public class BrokerConfig {
    private String mode = "PAPER"; // PAPER or LIVE
    private String provider = "MOCK"; // MOCK, ZERODHA, ANGEL
    private ZerodhaConfig zerodha = new ZerodhaConfig();
    private AngelConfig angel = new AngelConfig();
    
    @Data
    public static class ZerodhaConfig {
        private String apiKey;
        private String apiSecret;
        private String userId;
        private String password;
        private String totpSecret;
    }
    
    @Data
    public static class AngelConfig {
        private String apiKey;
        private String clientId;
        private String password;
        private String totpSecret;
    }
}
