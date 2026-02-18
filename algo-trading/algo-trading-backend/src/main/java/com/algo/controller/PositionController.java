package com.algo.controller;

import com.algo.model.Position;
import com.algo.service.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/positions")
@RequiredArgsConstructor
public class PositionController {
    
    private final PositionService positionService;
    
    @GetMapping
    public ResponseEntity<List<Position>> getUserPositions(Authentication authentication) {
        return ResponseEntity.ok(positionService.getUserPositions(authentication));
    }
    
    @GetMapping("/open")
    public ResponseEntity<List<Position>> getOpenPositions(Authentication authentication) {
        return ResponseEntity.ok(positionService.getOpenPositions(authentication));
    }
    
    @PostMapping("/{id}/update-price")
    public ResponseEntity<Void> updatePositionPrice(@PathVariable Long id, @RequestParam Double currentPrice) {
        positionService.updatePositionPrice(id, currentPrice);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{id}/close")
    public ResponseEntity<Position> closePosition(@PathVariable Long id, @RequestParam Double exitPrice) {
        return ResponseEntity.ok(positionService.closePosition(id, exitPrice));
    }
}
