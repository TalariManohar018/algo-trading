package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BrokerLoginRequest {
    private String apiKey;
    private String clientId;
    private String password;
    private String totpSecret;
    private String liveTotp; // Optional: direct 6-digit TOTP from authenticator app
}
