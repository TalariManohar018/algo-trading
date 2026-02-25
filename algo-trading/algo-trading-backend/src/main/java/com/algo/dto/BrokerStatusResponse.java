package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrokerStatusResponse {
    private boolean success;
    private boolean connected;
    private String broker;
    private String mode;
    private String clientId;
    private String message;
}
