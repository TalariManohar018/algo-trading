package com.algo.enums;

public enum ConditionType {
    GREATER_THAN(">"),
    LESS_THAN("<"),
    GREATER_THAN_EQUAL(">="),
    LESS_THAN_EQUAL("<="),
    EQUALS("="),
    CROSS_ABOVE("Crosses Above"),
    CROSS_BELOW("Crosses Below");
    
    private final String operator;
    
    ConditionType(String operator) {
        this.operator = operator;
    }
    
    public String getOperator() {
        return operator;
    }
    
    public static ConditionType fromOperator(String operator) {
        for (ConditionType type : values()) {
            if (type.operator.equals(operator)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown operator: " + operator);
    }
}
