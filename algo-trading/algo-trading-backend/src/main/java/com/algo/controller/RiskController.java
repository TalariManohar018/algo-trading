package com.algo.controller;

import com.algo.model.RiskState;
import com.algo.model.User;
import com.algo.service.RiskManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
public class RiskController {
    
    private final RiskManagementService riskManagementService;
    
    @GetMapping
    public ResponseEntity<RiskState> getUserRiskState(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(riskManagementService.getUserRiskState(user.getId()));
    }
    
    @PostMapping("/unlock")
    public ResponseEntity<Void> unlockEngine(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        riskManagementService.unlockEngine(user.getId());
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/reset")
    public ResponseEntity<Void> resetDailyLimits(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        riskManagementService.resetDailyLimits(user.getId());
        return ResponseEntity.ok().build();
    }
}
