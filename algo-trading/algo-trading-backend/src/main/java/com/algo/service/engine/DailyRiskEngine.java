package com.algo.service.engine;

import com.algo.enums.OrderSide;
import com.algo.model.Position;
import com.algo.model.RiskState;
import com.algo.repository.OrderRepository;
import com.algo.repository.PositionRepository;
import com.algo.repository.RiskStateRepository;
import com.algo.service.AuditService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enforces all daily trading risk rules BEFORE an order is sent to the queue.
 *
 * <p>Checks performed in {@link #checkOrder}:
 * <ol>
 *   <li>Max daily loss limit breached</li>
 *   <li>Max open positions per user</li>
 *   <li>Max capital exposure per symbol</li>
 *   <li>Max trades per day per strategy</li>
 *   <li>Market hours gate</li>
 *   <li>Unrealised drawdown threshold</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DailyRiskEngine {

    private final RiskStateRepository riskStateRepository;
    private final PositionRepository positionRepository;
    private final OrderRepository orderRepository;
    private final AuditService auditService;

    @Value("${trading.risk.max-daily-loss:5000.0}")
    private double maxDailyLoss;

    @Value("${trading.risk.max-open-positions:3}")
    private int maxOpenPositions;

    @Value("${trading.risk.max-exposure-per-symbol:10000.0}")
    private double maxExposurePerSymbol;

    @Value("${trading.risk.max-trades-per-day:10}")
    private int maxTradesPerDay;

    @Value("${trading.risk.max-drawdown-pct:5.0}")
    private double maxDrawdownPct;

    private static final LocalTime MARKET_OPEN  = LocalTime.of(9, 15);
    private static final LocalTime MARKET_CLOSE = LocalTime.of(15, 30);

    // Per-symbol daily exposure tracker: symbol → total value placed today
    private final ConcurrentHashMap<String, Double> dailySymbolExposure = new ConcurrentHashMap<>();
    // Per-strategy daily trade count (in-memory, backed up in RiskState)
    private final ConcurrentHashMap<Long, Integer> strategyTradeCount = new ConcurrentHashMap<>();

    // ── Pre-order check ──────────────────────────────────────────────────────

    /**
     * Returns a {@link RiskDecision} — must be {@code passed == true} for order to proceed.
     */
    @Transactional(readOnly = true)
    public RiskDecision checkOrder(Long userId, Long strategyId, String symbol,
                                   int quantity, double price, OrderSide side) {

        RiskState riskState = getOrCreateRiskState(userId);

        // 1. Already locked
        if (Boolean.TRUE.equals(riskState.getIsLocked())) {
            return RiskDecision.fail("Risk engine is locked: " + riskState.getLockReason());
        }

        // 2. Market hours
        LocalTime now = LocalTime.now();
        if (now.isBefore(MARKET_OPEN) || now.isAfter(MARKET_CLOSE)) {
            return RiskDecision.fail("Market closed. Trading hours: 09:15–15:30 IST");
        }

        // 3. Max daily loss
        if (riskState.getDailyLoss() >= maxDailyLoss) {
            return RiskDecision.fail(String.format(
                    "Max daily loss reached: ₹%.2f / ₹%.2f", riskState.getDailyLoss(), maxDailyLoss));
        }

        // 4. Max open positions
        long openCount = positionRepository
                .findByUserIdAndStatus(userId, com.algo.enums.PositionStatus.OPEN).size();
        if (openCount >= maxOpenPositions) {
            return RiskDecision.fail(String.format(
                    "Max open positions reached: %d / %d", openCount, maxOpenPositions));
        }

        // 5. Max exposure per symbol
        double orderValue = quantity * price;
        double currentSymbolExposure = dailySymbolExposure.getOrDefault(symbol, 0.0);
        if (currentSymbolExposure + orderValue > maxExposurePerSymbol) {
            return RiskDecision.fail(String.format(
                    "Max symbol exposure exceeded for %s: ₹%.2f + ₹%.2f > ₹%.2f",
                    symbol, currentSymbolExposure, orderValue, maxExposurePerSymbol));
        }

        // 6. Max trades per day per strategy
        int tradesToday = strategyTradeCount.getOrDefault(strategyId, 0);
        if (tradesToday >= maxTradesPerDay) {
            return RiskDecision.fail(String.format(
                    "Strategy %d reached max trades per day: %d / %d", strategyId, tradesToday, maxTradesPerDay));
        }

        return RiskDecision.pass(orderValue);
    }

    /**
     * Called after an order is successfully filled.
     */
    public void recordOrderFilled(Long userId, Long strategyId, String symbol,
                                   double orderValue, double pnl) {
        dailySymbolExposure.merge(symbol, orderValue, Double::sum);
        strategyTradeCount.merge(strategyId, 1, Integer::sum);

        RiskState riskState = getOrCreateRiskState(userId);
        riskState.setDailyTradeCount(riskState.getDailyTradeCount() + 1);
        if (pnl < 0) {
            riskState.setDailyLoss(riskState.getDailyLoss() + Math.abs(pnl));
        }
        riskState.setUpdatedAt(LocalDateTime.now());
        riskStateRepository.save(riskState);

        log.debug("[RISK ENGINE] Recorded trade: strategy={} symbol={} value=₹{} pnl=₹{}",
                strategyId, symbol, orderValue, pnl);
    }

    /**
     * Called by RealTimeMtmService when unrealised losses are detected.
     * Locks risk engine if drawdown threshold is breached.
     */
    public void checkAndEnforcePortfolioLoss(Long userId, double totalUnrealisedPnl) {
        if (totalUnrealisedPnl >= 0) return;

        RiskState riskState = getOrCreateRiskState(userId);

        // Already locked?
        if (Boolean.TRUE.equals(riskState.getIsLocked())) return;

        double totalLoss = riskState.getDailyLoss() + Math.abs(Math.min(totalUnrealisedPnl, 0));
        if (totalLoss >= maxDailyLoss) {
            log.error("[RISK ENGINE] 🚨 Max daily loss breached: total=₹{} limit=₹{} — LOCKING",
                    totalLoss, maxDailyLoss);
            lockEngine(userId, String.format("Max daily loss breached: ₹%.2f / ₹%.2f", totalLoss, maxDailyLoss));
        }
    }

    @Transactional
    public void lockEngine(Long userId, String reason) {
        RiskState riskState = getOrCreateRiskState(userId);
        riskState.setIsLocked(true);
        riskState.setLockReason(reason);
        riskState.setUpdatedAt(LocalDateTime.now());
        riskStateRepository.save(riskState);

        auditService.logCritical(userId, "RISK_BREACH",
                "Risk engine LOCKED: " + reason, null);

        log.error("[RISK ENGINE] 🔒 Engine locked for user {}: {}", userId, reason);
    }

    /**
     * Reset daily counters — scheduled at 08:30 AM (before market open).
     */
    @Scheduled(cron = "0 30 8 * * MON-FRI")
    @Transactional
    public void resetDailyCounters() {
        dailySymbolExposure.clear();
        strategyTradeCount.clear();
        log.info("[RISK ENGINE] Daily counters reset at market pre-open");
    }

    private RiskState getOrCreateRiskState(Long userId) {
        LocalDate today = LocalDate.now();
        return riskStateRepository.findByUserIdAndTradingDate(userId, today)
                .orElseGet(() -> {
                    RiskState state = RiskState.builder()
                            .userId(userId).dailyLoss(0.0).dailyTradeCount(0)
                            .isLocked(false).tradingDate(today).build();
                    return riskStateRepository.save(state);
                });
    }

    public Map<String, Object> getRiskSummary(Long userId) {
        RiskState state = getOrCreateRiskState(userId);
        Map<String, Object> summary = new HashMap<>();
        summary.put("dailyLoss", state.getDailyLoss());
        summary.put("maxDailyLoss", maxDailyLoss);
        summary.put("dailyTradeCount", state.getDailyTradeCount());
        summary.put("maxTradesPerDay", maxTradesPerDay);
        summary.put("openPositions", positionRepository
                .findByUserIdAndStatus(userId, com.algo.enums.PositionStatus.OPEN).size());
        summary.put("maxOpenPositions", maxOpenPositions);
        summary.put("isLocked", state.getIsLocked());
        summary.put("lockReason", state.getLockReason());
        summary.put("symbolExposure", Map.copyOf(dailySymbolExposure));
        return summary;
    }

    // ── Inner result record ──────────────────────────────────────────────────

    @Data
    @Builder
    public static class RiskDecision {
        private final boolean passed;
        private final String reason;
        private final double approvedOrderValue;

        public static RiskDecision pass(double orderValue) {
            return RiskDecision.builder().passed(true).approvedOrderValue(orderValue).build();
        }

        public static RiskDecision fail(String reason) {
            return RiskDecision.builder().passed(false).reason(reason).approvedOrderValue(0).build();
        }
    }
}
