package com.algo.enums;

public enum TimeFrame {
    ONE_MINUTE("1m"),
    FIVE_MINUTES("5m"),
    FIFTEEN_MINUTES("15m"),
    THIRTY_MINUTES("30m"),
    ONE_HOUR("1h"),
    ONE_DAY("1d");
    
    private final String value;
    
    TimeFrame(String value) {
        this.value = value;
    }
    
    public String getValue() {
        return value;
    }
    
    public static TimeFrame fromValue(String value) {
        for (TimeFrame tf : values()) {
            if (tf.value.equals(value)) {
                return tf;
            }
        }
        throw new IllegalArgumentException("Invalid timeframe: " + value);
    }
}
