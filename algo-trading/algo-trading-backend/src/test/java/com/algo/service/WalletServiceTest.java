package com.algo.service;

import com.algo.model.Wallet;
import com.algo.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Unit tests for Wallet Service
 */
@ExtendWith(MockitoExtension.class)
class WalletServiceTest {
    
    @Mock
    private WalletRepository walletRepository;
    
    @InjectMocks
    private WalletService walletService;
    
    private Wallet testWallet;
    
    @BeforeEach
    void setUp() {
        testWallet = Wallet.builder()
                .id(1L)
                .userId(1L)
                .balance(100000.0)
                .usedMargin(0.0)
                .availableMargin(100000.0)
                .realizedPnl(0.0)
                .unrealizedPnl(0.0)
                .build();
    }
    
    @Test
    @DisplayName("Should create wallet for new user")
    void testCreateWalletForUser() {
        when(walletRepository.save(any(Wallet.class))).thenReturn(testWallet);
        
        Wallet wallet = walletService.createWalletForUser(1L);
        
        assertNotNull(wallet);
        assertEquals(100000.0, wallet.getBalance());
        assertEquals(0.0, wallet.getUsedMargin());
        assertEquals(100000.0, wallet.getAvailableMargin());
        
        verify(walletRepository, times(1)).save(any(Wallet.class));
    }
    
    @Test
    @DisplayName("Should return existing wallet for user")
    void testGetExistingWallet() {
        when(walletRepository.findByUserId(1L)).thenReturn(Optional.of(testWallet));
        
        Wallet wallet = walletService.getUserWallet(1L);
        
        assertNotNull(wallet);
        assertEquals(testWallet.getUserId(), wallet.getUserId());
        assertEquals(testWallet.getBalance(), wallet.getBalance());
        
        verify(walletRepository, times(1)).findByUserId(1L);
    }
    
    @Test
    @DisplayName("Should update balance after position close with profit")
    void testUpdateBalanceWithProfit() {
        when(walletRepository.findByUserId(1L)).thenReturn(Optional.of(testWallet));
        when(walletRepository.save(any(Wallet.class))).thenReturn(testWallet);
        
        double profit = 500.0;
        walletService.updateBalanceOnPositionClose(1L, profit);
        
        assertEquals(100500.0, testWallet.getBalance());
        assertEquals(500.0, testWallet.getRealizedPnl());
        
        verify(walletRepository, times(1)).save(testWallet);
    }
    
    @Test
    @DisplayName("Should update balance after position close with loss")
    void testUpdateBalanceWithLoss() {
        when(walletRepository.findByUserId(1L)).thenReturn(Optional.of(testWallet));
        when(walletRepository.save(any(Wallet.class))).thenReturn(testWallet);
        
        double loss = -300.0;
        walletService.updateBalanceOnPositionClose(1L, loss);
        
        assertEquals(99700.0, testWallet.getBalance());
        assertEquals(-300.0, testWallet.getRealizedPnl());
        
        verify(walletRepository, times(1)).save(testWallet);
    }
}
