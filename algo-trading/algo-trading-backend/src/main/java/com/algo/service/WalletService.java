package com.algo.service;

import com.algo.model.Order;
import com.algo.model.Wallet;
import com.algo.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class WalletService {
    
    private final WalletRepository walletRepository;
    
    public Wallet getUserWallet(Long userId) {
        return walletRepository.findByUserId(userId)
                .orElseGet(() -> createWalletForUser(userId));
    }
    
    @Transactional
    public Wallet createWalletForUser(Long userId) {
        Wallet wallet = Wallet.builder()
                .userId(userId)
                .balance(100000.0)
                .usedMargin(0.0)
                .availableMargin(100000.0)
                .realizedPnl(0.0)
                .unrealizedPnl(0.0)
                .build();
        return walletRepository.save(wallet);
    }
    
    @Transactional
    public void updateMarginOnOrderFilled(Long userId, Order order) {
        Wallet wallet = getUserWallet(userId);
        double marginRequired = order.getFilledPrice() * order.getQuantity() * 0.2; // 20% margin
        
        wallet.setUsedMargin(wallet.getUsedMargin() + marginRequired);
        wallet.setAvailableMargin(wallet.getBalance() - wallet.getUsedMargin());
        wallet.setUpdatedAt(LocalDateTime.now());
        
        walletRepository.save(wallet);
    }
    
    @Transactional
    public void updateOnPositionClosed(Long userId, Double pnl, Double marginReleased) {
        Wallet wallet = getUserWallet(userId);
        
        wallet.setBalance(wallet.getBalance() + pnl);
        wallet.setRealizedPnl(wallet.getRealizedPnl() + pnl);
        wallet.setUsedMargin(wallet.getUsedMargin() - marginReleased);
        wallet.setAvailableMargin(wallet.getBalance() - wallet.getUsedMargin());
        wallet.setUpdatedAt(LocalDateTime.now());
        
        walletRepository.save(wallet);
    }
    
    @Transactional
    public void updateUnrealizedPnl(Long userId, Double unrealizedPnl) {
        Wallet wallet = getUserWallet(userId);
        wallet.setUnrealizedPnl(unrealizedPnl);
        wallet.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(wallet);
    }
    
    @Transactional
    public void updateBalanceOnPositionClose(Long userId, double pnl) {
        Wallet wallet = getUserWallet(userId);
        wallet.setBalance(wallet.getBalance() + pnl);
        wallet.setRealizedPnl(wallet.getRealizedPnl() + pnl);
        wallet.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(wallet);
    }
}
