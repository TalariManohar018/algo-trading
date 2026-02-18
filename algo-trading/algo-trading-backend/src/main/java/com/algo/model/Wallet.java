package com.algo.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "wallets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Wallet {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private Long userId;
    
    @Column(nullable = false)
    private Double balance = 100000.0;
    
    @Column(nullable = false)
    private Double usedMargin = 0.0;
    
    @Column(nullable = false)
    private Double availableMargin = 100000.0;
    
    @Column(nullable = false)
    private Double realizedPnl = 0.0;
    
    @Column(nullable = false)
    private Double unrealizedPnl = 0.0;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
