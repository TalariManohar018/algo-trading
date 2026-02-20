package com.algo.service.broker;

import com.algo.config.BrokerConfig;
import com.algo.dto.BrokerPositionResponse;
import com.algo.model.Order;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * Angel One (AngelBroking) SmartAPI Integration
 * <p>
 * The API secret is injected from the environment variable {@code ANGEL_API_SECRET}
 * via {@code application.yml} → {@code broker.angel.api-secret}.
 * <p>
 * To fully enable live trading:
 * 1. Set all ANGEL_* environment variables (see .env.example)
 * 2. Add SmartAPI SDK dependency to pom.xml
 * 3. Implement authentication with TOTP
 * 4. Change broker.mode=LIVE and broker.provider=ANGEL in application.yml
 */
@Service
@Slf4j
public class AngelBrokerService implements BrokerService {

    private final BrokerConfig brokerConfig;

    // Injected from application.yml → ${ANGEL_API_SECRET:}
    @Value("${broker.angel.api-secret:}")
    private String apiSecret;

    public AngelBrokerService(BrokerConfig brokerConfig) {
        this.brokerConfig = brokerConfig;
    }

    @PostConstruct
    public void init() {
        BrokerConfig.AngelConfig angel = brokerConfig.getAngel();
        if (apiSecret != null && !apiSecret.isBlank()) {
            log.info("Angel One API Secret loaded successfully (masked: {})", angel.getMaskedApiSecret());
        } else {
            log.warn("Angel One API Secret is NOT configured. Set ANGEL_API_SECRET environment variable.");
        }
        // Log other config presence (never log actual values)
        log.info("Angel One config — apiKey: {}, clientId: {}, password: {}, totpSecret: {}",
                isSet(angel.getApiKey()), isSet(angel.getClientId()),
                isSet(angel.getPassword()), isSet(angel.getTotpSecret()));
    }

    private String isSet(String value) {
        return (value != null && !value.isBlank()) ? "[SET]" : "[NOT SET]";
    }

    @Override
    public String placeOrder(Order order) {
        requireConfigured();
        // TODO: Implement SmartAPI order placement using apiSecret
        throw new UnsupportedOperationException("Angel One SmartAPI order placement not yet implemented.");
    }

    @Override
    public void cancelOrder(String brokerOrderId) {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI cancel order not yet implemented.");
    }

    @Override
    public OrderStatusResponse getOrderStatus(String brokerOrderId) {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI order status not yet implemented.");
    }

    @Override
    public double getCurrentPrice(String symbol) {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI market data not yet implemented.");
    }

    @Override
    public double getAccountBalance() {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI account balance not yet implemented.");
    }

    @Override
    public boolean isConnected() {
        return apiSecret != null && !apiSecret.isBlank();
    }

    @Override
    public List<BrokerPositionResponse> getPositions() {
        return Collections.emptyList();
    }

    @Override
    public void squareOffAll() {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI square-off not yet implemented.");
    }

    @Override
    public void cancelAllOrders() {
        requireConfigured();
        throw new UnsupportedOperationException("Angel One SmartAPI cancel-all not yet implemented.");
    }

    /**
     * Guard method — ensures the API secret is present before any live operation.
     */
    private void requireConfigured() {
        if (apiSecret == null || apiSecret.isBlank()) {
            throw new IllegalStateException(
                "Angel One API Secret is not configured. " +
                "Set the ANGEL_API_SECRET environment variable and restart.");
        }
    }
}
