package com.algo.service.broker;

import com.algo.config.BrokerConfig;
import com.algo.dto.BrokerLoginRequest;
import com.algo.dto.BrokerStatusResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class BrokerConnectionService {
    
    private final BrokerConfig brokerConfig;
    private final MockBrokerService mockBrokerService;
    private final AngelBrokerService angelBrokerService;
    
    private BrokerService activeBrokerService;
    private boolean connected = false;
    private String currentBroker = "MOCK";
    private String currentMode = "PAPER";
    private String currentClientId = null;
    
    public BrokerConnectionService(BrokerConfig brokerConfig, 
                                   MockBrokerService mockBrokerService,
                                   AngelBrokerService angelBrokerService) {
        this.brokerConfig = brokerConfig;
        this.mockBrokerService = mockBrokerService;
        this.angelBrokerService = angelBrokerService;
        
        // Initialize with mock by default
        this.activeBrokerService = mockBrokerService;
        this.currentMode = brokerConfig.getMode();
        this.currentBroker = brokerConfig.getProvider();
    }
    
    /**
     * Connect to a broker with provided credentials
     */
    public BrokerStatusResponse connect(BrokerLoginRequest request) {
        try {
            log.info("Attempting to connect to broker with credentials for client: {}", request.getClientId());
            
            // Validate credentials
            if (request.getApiKey() == null || request.getApiKey().isBlank()) {
                return BrokerStatusResponse.builder()
                        .success(false)
                        .connected(false)
                        .broker(currentBroker)
                        .mode(currentMode)
                        .message("API Key is required")
                        .build();
            }
            
            if (request.getClientId() == null || request.getClientId().isBlank()) {
                return BrokerStatusResponse.builder()
                        .success(false)
                        .connected(false)
                        .broker(currentBroker)
                        .mode(currentMode)
                        .message("Client ID is required")
                        .build();
            }
            
            // Update configuration dynamically
            brokerConfig.getAngel().setApiKey(request.getApiKey());
            brokerConfig.getAngel().setClientId(request.getClientId());
            brokerConfig.getAngel().setPassword(request.getPassword());
            brokerConfig.getAngel().setTotpSecret(request.getTotpSecret());
            
            // Switch to Angel One broker
            brokerConfig.setProvider("ANGEL");
            brokerConfig.setMode("LIVE");
            
            // Use Angel One service
            this.activeBrokerService = angelBrokerService;
            this.currentBroker = "ANGEL_ONE";
            this.currentMode = "LIVE";
            this.currentClientId = request.getClientId();
            this.connected = true;
            
            log.info("✅ Connected to Angel One for client: {}", request.getClientId());
            
            return BrokerStatusResponse.builder()
                    .success(true)
                    .connected(true)
                    .broker("ANGEL_ONE")
                    .mode("LIVE")
                    .clientId(request.getClientId())
                    .message("Successfully connected to Angel One")
                    .build();
            
        } catch (Exception e) {
            log.error("Failed to connect to broker: {}", e.getMessage(), e);
            
            return BrokerStatusResponse.builder()
                    .success(false)
                    .connected(false)
                    .broker(currentBroker)
                    .mode(currentMode)
                    .message("Connection failed: " + e.getMessage())
                    .build();
        }
    }
    
    /**
     * Disconnect from broker
     */
    public BrokerStatusResponse disconnect() {
        try {
            log.info("Disconnecting from broker: {}", currentBroker);
            
            // Reset to mock broker
            this.activeBrokerService = mockBrokerService;
            this.connected = false;
            this.currentBroker = "MOCK";
            this.currentMode = "PAPER";
            this.currentClientId = null;
            
            // Reset configuration
            brokerConfig.setProvider("MOCK");
            brokerConfig.setMode("PAPER");
            
            return BrokerStatusResponse.builder()
                    .success(true)
                    .connected(false)
                    .broker("MOCK")
                    .mode("PAPER")
                    .message("Disconnected from broker")
                    .build();
                    
        } catch (Exception e) {
            log.error("Error during disconnect: {}", e.getMessage(), e);
            return BrokerStatusResponse.builder()
                    .success(false)
                    .connected(connected)
                    .broker(currentBroker)
                    .mode(currentMode)
                    .message("Disconnect failed: " + e.getMessage())
                    .build();
        }
    }
    
    /**
     * Get current broker status
     */
    public BrokerStatusResponse getStatus() {
        return BrokerStatusResponse.builder()
                .success(true)
                .connected(connected)
                .broker(currentBroker)
                .mode(currentMode)
                .clientId(currentClientId)
                .message(connected ? "Connected" : "Not connected")
                .build();
    }
    
    /**
     * Get the active broker service
     */
    public BrokerService getActiveBrokerService() {
        return activeBrokerService;
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected() {
        return connected;
    }
}
