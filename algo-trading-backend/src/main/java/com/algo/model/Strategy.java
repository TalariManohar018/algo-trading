package com.algo.model;

import com.algo.enums.InstrumentType;
import com.algo.enums.StrategyStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "strategies")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Strategy {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InstrumentType instrument;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StrategyStatus status = StrategyStatus.STOPPED;
    
    @OneToMany(mappedBy = "strategy", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Condition> conditions = new ArrayList<>();
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public void addCondition(Condition condition) {
        conditions.add(condition);
        condition.setStrategy(this);
    }
}
