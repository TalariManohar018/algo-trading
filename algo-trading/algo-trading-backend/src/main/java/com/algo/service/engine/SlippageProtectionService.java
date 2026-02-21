package com.algo.service.engine;

import com.algo.enums.OrderSide;
import com.algo.service.AuditService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slippage protection gate — must pass before an order is enqueued.
 *
 * <p>Checks:
 * <ol>
 *   <li>Signal age: reject if signal is older than {@code MAX_SIGNAL_AGE_MS}</li>
 *   <li>Estimated slippage: model spread + market impact</li>
 *   <li>Per-strategy configurable max-slippage override</li>
 * </ol>
 *
 * <p>After a fill, call {@link #recordActualSlippage} to track latency and
 * real vs expected slippage for monitoring.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SlippageProtectionService {

    private static final long MAX_SIGNAL_AGE_MS = 3_000;

    private final AuditService auditService;

    @Value("${trading.slippage.default-max-pct:0.5}")
    private double defaultMaxSlippagePct;

    // Per-symbol spread/impact config (bps → %)
    private static final Map<String, SymbolConfig> SYMBOL_CONFIGS = Map.of(
        "NIFTY",       new SymbolConfig(0.01, 0.005),
        "BANKNIFTY",   new SymbolConfig(0.02, 0.008),
        "SENSEX",      new SymbolConfig(0.015, 0.006),
        "RELIANCE",    new SymbolConfig(0.03, 0.010),
        "TCS",         new SymbolConfig(0.03, 0.010),
        "HDFCBANK",    new SymbolConfig(0.04, 0.012),
        "INFY",        new SymbolConfig(0.03, 0.010)
    );
    private static final SymbolConfig DEFAULT_CONFIG = new SymbolConfig(0.08, 0.020);

    // Per-strategy overrides
    private final ConcurrentHashMap<Long, Double> strategyMaxSlippagePct = new ConcurrentHashMap<>();

    // Latency stats (signal time → order placement time)
    private final ConcurrentHashMap<String, Long> signalToOrderLatencies = new ConcurrentHashMap<>();

    // ── Main check ───────────────────────────────────────────────────────────

    /**
     * @param strategyId   strategy (used for per-strategy override)
     * @param symbol       trading symbol
     * @param side         BUY or SELL
     * @param signalPrice  mid-price at signal generation
     * @param quantity     order quantity
     * @param signalTime   when the signal was generated
     * @return {@link SlippageDecision}
     */
    public SlippageDecision check(Long strategyId, String symbol, OrderSide side,
                                  double signalPrice, int quantity, LocalDateTime signalTime) {

        long ageMs = signalTime != null
                ? ChronoUnit.MILLIS.between(signalTime, LocalDateTime.now()) : 0;

        // 1. Stale signal rejection
        if (ageMs > MAX_SIGNAL_AGE_MS) {
            log.warn("[SLIPPAGE] Stale signal rejected: {} age={}ms > {}ms limit",
                    symbol, ageMs, MAX_SIGNAL_AGE_MS);
            return SlippageDecision.rejected(symbol, 0, 0,
                    String.format("Signal too stale: %dms > %dms limit", ageMs, MAX_SIGNAL_AGE_MS));
        }

        // 2. Estimate slippage
        SymbolConfig cfg = SYMBOL_CONFIGS.getOrDefault(symbol, DEFAULT_CONFIG);
        double halfSpread   = cfg.spreadPct / 2.0;
        double orderValueL  = (signalPrice * quantity) / 100_000.0; // in lakhs
        double marketImpact = cfg.impactPctPerLakh * orderValueL;
        double timingSlip   = ageMs > 1000 ? (ageMs / 1000.0) * 0.01 : 0; // 0.01% per second after 1s

        double totalSlippage = halfSpread + marketImpact + timingSlip;

        // 3. Adjusted entry price
        double adjustedPrice = side == OrderSide.BUY
                ? signalPrice * (1 + totalSlippage / 100)
                : signalPrice * (1 - totalSlippage / 100);

        // 4. Check against max allowed
        double maxAllowed = strategyMaxSlippagePct.getOrDefault(strategyId, defaultMaxSlippagePct);
        boolean viable = totalSlippage <= maxAllowed;

        if (!viable) {
            log.warn("[SLIPPAGE] Rejected: {} estimated slippage={:.3f}% > max={:.3f}%",
                    symbol, totalSlippage, maxAllowed);
            return SlippageDecision.rejected(symbol, totalSlippage, adjustedPrice,
                    String.format("Slippage too high: %.3f%% > %.3f%%", totalSlippage, maxAllowed));
        }

        log.debug("[SLIPPAGE] {} {} slippage={:.3f}% adjustedPrice={:.2f} (spread={:.3f}% impact={:.3f}%)",
                symbol, side, totalSlippage, adjustedPrice, halfSpread, marketImpact);

        return SlippageDecision.accepted(symbol, totalSlippage, adjustedPrice);
    }

    /**
     * Record actual slippage after a fill for monitoring / audit.
     */
    public void recordActualSlippage(Long userId, Long orderId, String symbol,
                                     double signalPrice, double filledPrice,
                                     double estimatedPct, LocalDateTime signalTime) {
        double actualPct = signalPrice > 0
                ? Math.abs((filledPrice - signalPrice) / signalPrice) * 100
                : 0;

        long latencyMs = signalTime != null
                ? ChronoUnit.MILLIS.between(signalTime, LocalDateTime.now()) : 0;

        signalToOrderLatencies.put(orderId + ":" + symbol, latencyMs);

        auditService.logInfo(userId, "SLIPPAGE_ACTUAL",
                String.format("Slippage actual=%.3f%% expected=%.3f%% latency=%dms | %s",
                        actualPct, estimatedPct, latencyMs, symbol),
                Map.of("orderId", orderId, "symbol", symbol,
                       "signalPrice", signalPrice, "filledPrice", filledPrice));
    }

    public void setStrategyMaxSlippagePct(Long strategyId, double maxPct) {
        strategyMaxSlippagePct.put(strategyId, maxPct);
    }

    public Map<String, Object> getLatencyStats() {
        if (signalToOrderLatencies.isEmpty()) {
            return Map.of("count", 0, "avgMs", 0, "p95Ms", 0);
        }
        long[] sorted = signalToOrderLatencies.values().stream()
                .mapToLong(Long::longValue).sorted().toArray();
        long avg = (long) (java.util.Arrays.stream(sorted).average().orElse(0));
        long p95 = sorted[(int) Math.ceil(sorted.length * 0.95) - 1];
        return Map.of("count", sorted.length, "avgMs", avg, "p95Ms", p95);
    }

    // ── Config records ───────────────────────────────────────────────────────

    private record SymbolConfig(double spreadPct, double impactPctPerLakh) {}

    @Data
    @Builder
    public static class SlippageDecision {
        private final String symbol;
        private final boolean viable;
        private final double estimatedSlippagePct;
        private final double adjustedPrice;
        private final String rejectionReason;

        public static SlippageDecision accepted(String symbol, double slippage, double adjusted) {
            return SlippageDecision.builder()
                    .symbol(symbol).viable(true)
                    .estimatedSlippagePct(slippage).adjustedPrice(adjusted).build();
        }

        public static SlippageDecision rejected(String symbol, double slippage, double adjusted, String reason) {
            return SlippageDecision.builder()
                    .symbol(symbol).viable(false)
                    .estimatedSlippagePct(slippage).adjustedPrice(adjusted)
                    .rejectionReason(reason).build();
        }
    }
}
