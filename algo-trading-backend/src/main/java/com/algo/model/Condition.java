package com.algo.model;

import com.algo.enums.ConditionType;
import com.algo.enums.IndicatorType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "conditions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Condition {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IndicatorType indicator;
    
    @Column(nullable = false)
    private String conditionOperator;
    
    @Column(name = "condition_value", nullable = false)
    private String value;
    
    @Column(name = "logic_operator")
    private String logicOperator; // AND or OR
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id")
    @JsonIgnore
    private Strategy strategy;
    
    public ConditionType getConditionType() {
        return ConditionType.fromOperator(conditionOperator);
    }
}
