package com.algo.controller;

import com.algo.model.User;
import com.algo.model.Wallet;
import com.algo.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {
    
    private final WalletService walletService;
    
    @GetMapping
    public ResponseEntity<Wallet> getUserWallet(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(walletService.getUserWallet(user.getId()));
    }
}
