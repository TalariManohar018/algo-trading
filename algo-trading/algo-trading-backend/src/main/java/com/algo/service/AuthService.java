package com.algo.service;

import com.algo.config.JwtService;
import com.algo.dto.AuthResponse;
import com.algo.dto.LoginRequest;
import com.algo.dto.RegisterRequest;
import com.algo.model.User;
import com.algo.model.Wallet;
import com.algo.repository.UserRepository;
import com.algo.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        
        var user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .enabled(true)
                .build();
        
        userRepository.save(user);
        
        // Create wallet for user
        var wallet = Wallet.builder()
                .userId(user.getId())
                .balance(100000.0)
                .usedMargin(0.0)
                .availableMargin(100000.0)
                .realizedPnl(0.0)
                .unrealizedPnl(0.0)
                .build();
        
        walletRepository.save(wallet);
        
        var jwtToken = jwtService.generateToken(user);
        
        return AuthResponse.builder()
                .token(jwtToken)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }
    
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        var jwtToken = jwtService.generateToken(user);
        
        return AuthResponse.builder()
                .token(jwtToken)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }
}
