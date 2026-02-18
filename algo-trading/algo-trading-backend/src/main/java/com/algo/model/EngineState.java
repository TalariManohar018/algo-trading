package com.algo.model;

import com.algo.enums.EngineStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "engine_state")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EngineState {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long userId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EngineStatus status = EngineStatus.STOPPED;
    
    private String lockReason;
    
    @Column(nullable = false)
    private LocalDateTime lastTickAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
