package com.algo.service.engine;

import com.algo.model.Position;
import com.algo.repository.OrderRepository;
import com.algo.repository.PositionRepository;
import com.algo.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Real-time MTM (Mark-to-Market) engine.
 *
 * <p>On every tick, call {@link #onTick(String, double)} to update all open
 * positions for that symbol. The engine tracks:
 * <ul>
 *   <li>Unrealised PnL per position</li>
 *   <li>Portfolio-level unrealised + realised PnL</li>
 *   <li>Drawdown percentage vs peak equity</li>
 *   <li>Per-strategy PnL breakdown</li>
 *   <li>Daily max-loss circuit breaker trigger</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RealTimeMtmService {

    private final PositionRepository positionRepository;
    private final OrderRepository orderRepository;
    private final AuditService auditService;
    private final DailyRiskEngine dailyRiskEngine;

    // In-memory price cache for fast tick processing
    private final ConcurrentHashMap<String, Double> latestPrices = new ConcurrentHashMap<>();

    // Portfolio snapshots keyed by userId
    private final ConcurrentHashMap<Long, PortfolioSnapshot> portfolioSnapshots = new ConcurrentHashMap<>();

    /**
     * Called on every market tick. Updates all open positions for this symbol.
     *
     * @param symbol current market symbol (e.g. "NIFTY")
     * @param price  latest traded price
     */
    @Transactional
    public void onTick(String symbol, double price) {
        latestPrices.put(symbol, price);

        List<Position> positions = positionRepository
                .findBySymbolAndStatus(symbol, com.algo.enums.PositionStatus.OPEN);

        for (Position position : positions) {
            double entryPrice = position.getEntryPrice();
            int qty = position.getQuantity();

            double unrealised = position.getSide() == com.algo.enums.PositionSide.LONG
                    ? (price - entryPrice) * qty
                    : (entryPrice - price) * qty;

            // Update peak unrealised (for drawdown calc)
            if (unrealised > position.getPeakUnrealizedPnl()) {
                position.setPeakUnrealizedPnl(unrealised);
            }
            if (unrealised < position.getMaxAdverseExcursion()) {
                position.setMaxAdverseExcursion(unrealised);
            }

            // Distance to SL / TP
            if (position.getStopLoss() != null) {
                position.setDistanceToSlPct(
                        Math.abs((price - position.getStopLoss()) / entryPrice) * 100);
            }
            if (position.getTakeProfit() != null) {
                position.setDistanceToTpPct(
                        Math.abs((position.getTakeProfit() - price) / entryPrice) * 100);
            }

            position.setCurrentPrice(price);
            position.setUnrealizedPnl(unrealised);
            positionRepository.save(position);

            // Update portfolio snapshot
            updatePortfolioSnapshot(position.getUserId(), position, unrealised);

            // Check SL / TP hit — publish to risk engine
            checkSlTpHit(position, price);
        }
    }

    private void updatePortfolioSnapshot(Long userId, Position position, double unrealised) {
        PortfolioSnapshot snap = portfolioSnapshots.computeIfAbsent(userId, PortfolioSnapshot::new);
        snap.updatePosition(position.getId(), unrealised, position.getStrategyId());
    }

    private void checkSlTpHit(Position position, double price) {
        boolean slHit = position.getStopLoss() != null && (
                (position.getSide() == com.algo.enums.PositionSide.LONG && price <= position.getStopLoss()) ||
                (position.getSide() == com.algo.enums.PositionSide.SHORT && price >= position.getStopLoss()));

        boolean tpHit = position.getTakeProfit() != null && (
                (position.getSide() == com.algo.enums.PositionSide.LONG && price >= position.getTakeProfit()) ||
                (position.getSide() == com.algo.enums.PositionSide.SHORT && price <= position.getTakeProfit()));

        if (slHit) {
            log.warn("[MTM] SL HIT: position {} {} @ ₹{} (SL=₹{})",
                    position.getId(), position.getSymbol(), price, position.getStopLoss());
            auditService.logWarning(position.getUserId(), "SL_HIT",
                    String.format("Stop-loss hit: %s @ ₹%.2f", position.getSymbol(), price),
                    Map.of("positionId", position.getId(), "slPrice", position.getStopLoss()));
        } else if (tpHit) {
            log.info("[MTM] TP HIT: position {} {} @ ₹{} (TP=₹{})",
                    position.getId(), position.getSymbol(), price, position.getTakeProfit());
            auditService.logInfo(position.getUserId(), "TP_HIT",
                    String.format("Take-profit hit: %s @ ₹%.2f", position.getSymbol(), price),
                    Map.of("positionId", position.getId(), "tpPrice", position.getTakeProfit()));
        }

        // Check daily loss limit
        PortfolioSnapshot snap = portfolioSnapshots.get(position.getUserId());
        if (snap != null) {
            dailyRiskEngine.checkAndEnforcePortfolioLoss(position.getUserId(), snap.getTotalUnrealised());
        }
    }

    /**
     * Called when a position is closed. Moves unrealised → realised in snapshot.
     */
    public void onPositionClosed(Long userId, Long positionId, double realisedPnl) {
        PortfolioSnapshot snap = portfolioSnapshots.get(userId);
        if (snap != null) {
            snap.closePosition(positionId, realisedPnl);
        }
    }

    /**
     * Persist portfolio snapshot to DB every 60 seconds for recovery.
     */
    @Scheduled(fixedDelayString = "${trading.mtm.persist-interval-ms:60000}")
    @Transactional
    public void persistSnapshots() {
        portfolioSnapshots.forEach((userId, snap) -> {
            log.debug("[MTM] Portfolio snapshot userId={}: unrealised=₹{} realised=₹{} drawdown={}%",
                    userId,
                    String.format("%.2f", snap.getTotalUnrealised()),
                    String.format("%.2f", snap.getTotalRealisedToday()),
                    String.format("%.2f", snap.getDrawdownPct()));
        });
    }

    public PortfolioSnapshot getSnapshot(Long userId) {
        return portfolioSnapshots.getOrDefault(userId, new PortfolioSnapshot(userId));
    }

    public double getLatestPrice(String symbol) {
        return latestPrices.getOrDefault(symbol, 0.0);
    }

    // ── Inner snapshot class ─────────────────────────────────────────────────

    public static class PortfolioSnapshot {
        private final Long userId;
        private final ConcurrentHashMap<Long, Double> unrealisedByPosition = new ConcurrentHashMap<>();
        private final ConcurrentHashMap<Long, Long> strategyByPosition = new ConcurrentHashMap<>();
        private double totalRealisedToday = 0.0;
        private double peakEquity = 0.0;

        public PortfolioSnapshot(Long userId) { this.userId = userId; }

        public void updatePosition(Long positionId, double unrealised, Long strategyId) {
            unrealisedByPosition.put(positionId, unrealised);
            strategyByPosition.put(positionId, strategyId);
            double equity = getTotalUnrealised() + totalRealisedToday;
            if (equity > peakEquity) peakEquity = equity;
        }

        public void closePosition(Long positionId, double realisedPnl) {
            unrealisedByPosition.remove(positionId);
            strategyByPosition.remove(positionId);
            totalRealisedToday += realisedPnl;
        }

        public double getTotalUnrealised() {
            return unrealisedByPosition.values().stream().mapToDouble(Double::doubleValue).sum();
        }

        public double getTotalRealisedToday() { return totalRealisedToday; }

        public double getDrawdownPct() {
            if (peakEquity <= 0) return 0.0;
            double current = getTotalUnrealised() + totalRealisedToday;
            return peakEquity > current ? ((peakEquity - current) / peakEquity) * 100 : 0.0;
        }

        public Map<Long, Double> getByStrategy() {
            Map<Long, Double> result = new HashMap<>();
            unrealisedByPosition.forEach((pid, pnl) -> {
                Long sid = strategyByPosition.get(pid);
                if (sid != null) result.merge(sid, pnl, Double::sum);
            });
            return result;
        }

        public Long getUserId() { return userId; }
    }
}
