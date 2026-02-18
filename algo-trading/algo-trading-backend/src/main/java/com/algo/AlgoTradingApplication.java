package com.algo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AlgoTradingApplication {

    public static void main(String[] args) {
        SpringApplication.run(AlgoTradingApplication.class, args);
        System.out.println("🚀 Algo Trading Backend is running!");
    }
}
