package com.algo.service;

import com.algo.enums.PositionSide;
import com.algo.enums.PositionStatus;
import com.algo.model.Order;
import com.algo.model.Position;
import com.algo.model.User;
import com.algo.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PositionService {
    
    private final PositionRepository positionRepository;
    private final WalletService walletService;
    
    @Transactional
    public Position createPosition(Order order, Double currentPrice) {
        Position position = Position.builder()
                .userId(order.getUserId())
                .strategyId(order.getStrategyId())
                .strategyName(order.getStrategyName())
                .symbol(order.getSymbol())
                .side(order.getSide().name().equals("BUY") ? PositionSide.LONG : PositionSide.SHORT)
                .quantity(order.getQuantity())
                .entryPrice(order.getFilledPrice())
                .currentPrice(currentPrice)
                .unrealizedPnl(0.0)
                .realizedPnl(0.0)
                .status(PositionStatus.OPEN)
                .openedAt(LocalDateTime.now())
                .build();
        
        return positionRepository.save(position);
    }
    
    @Transactional
    public void updatePositionPrice(Long positionId, Double currentPrice) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new RuntimeException("Position not found"));
        
        double unrealizedPnl = calculateUnrealizedPnl(
                position.getEntryPrice(),
                currentPrice,
                position.getQuantity(),
                position.getSide()
        );
        
        position.setCurrentPrice(currentPrice);
        position.setUnrealizedPnl(unrealizedPnl);
        
        positionRepository.save(position);
    }
    
    @Transactional
    public Position closePosition(Long positionId, Double exitPrice) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new RuntimeException("Position not found"));
        
        if (position.getStatus() != PositionStatus.OPEN) {
            throw new RuntimeException("Can only close OPEN positions");
        }
        
        double pnl = calculateRealizedPnl(
                position.getEntryPrice(),
                exitPrice,
                position.getQuantity(),
                position.getSide()
        );
        
        position.setStatus(PositionStatus.CLOSED);
        position.setCurrentPrice(exitPrice);
        position.setRealizedPnl(pnl);
        position.setClosedAt(LocalDateTime.now());
        
        // Update wallet
        double marginReleased = position.getEntryPrice() * position.getQuantity() * 0.2;
        walletService.updateOnPositionClosed(position.getUserId(), pnl, marginReleased);
        
        return positionRepository.save(position);
    }
    
    public List<Position> getUserPositions(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return positionRepository.findByUserIdOrderByOpenedAtDesc(user.getId());
    }
    
    public List<Position> getOpenPositions(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return positionRepository.findByUserIdAndStatus(user.getId(), PositionStatus.OPEN);
    }
    
    public List<Position> getOpenPositionsByStrategy(Long strategyId) {
        return positionRepository.findByStrategyIdAndStatus(strategyId, PositionStatus.OPEN);
    }
    
    private double calculateUnrealizedPnl(Double entryPrice, Double currentPrice, Integer quantity, PositionSide side) {
        if (side == PositionSide.LONG) {
            return (currentPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - currentPrice) * quantity;
        }
    }
    
    private double calculateRealizedPnl(Double entryPrice, Double exitPrice, Integer quantity, PositionSide side) {
        if (side == PositionSide.LONG) {
            return (exitPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - exitPrice) * quantity;
        }
    }
}
