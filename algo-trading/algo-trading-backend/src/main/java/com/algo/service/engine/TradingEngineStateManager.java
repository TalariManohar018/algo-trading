package com.algo.service.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Global state manager for trading engine.
 * Controls whether trading signals are accepted or blocked.
 * Used during startup recovery to pause trading until reconciliation completes.
 */
@Component
@Slf4j
public class TradingEngineStateManager {

    private final AtomicBoolean tradingEnabled = new AtomicBoolean(false);
    private volatile String pauseReason = "System starting up";

    /**
     * Check if trading is currently allowed
     */
    public boolean isTradingEnabled() {
        return tradingEnabled.get();
    }

    /**
     * Enable trading (called after successful recovery)
     */
    public void enableTrading() {
        if (tradingEnabled.compareAndSet(false, true)) {
            pauseReason = null;
            log.info("[STATE] ✅ Trading ENABLED");
        }
    }

    /**
     * Disable trading with reason
     */
    public void pauseTrading(String reason) {
        if (tradingEnabled.compareAndSet(true, false)) {
            pauseReason = reason;
            log.warn("[STATE] ⏸️  Trading PAUSED: {}", reason);
        }
    }

    /**
     * Get current pause reason (null if trading is enabled)
     */
    public String getPauseReason() {
        return pauseReason;
    }
}
