package com.algo.service.broker;

import com.algo.config.BrokerConfig;
import com.algo.dto.BrokerPositionResponse;
import com.algo.enums.OrderStatus;
import com.algo.model.Order;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Zerodha Kite Connect Integration
 * 
 * Setup Instructions:
 * 1. Create a Kite Connect app at https://developers.kite.trade/
 * 2. Configure broker.zerodha properties in application.yml
 * 3. Generate access token via login flow
 * 4. Set broker.provider=ZERODHA in application.yml
 * 
 * API Documentation: https://kite.trade/docs/connect/v3/
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZerodhaBrokerService implements BrokerService {
    
    private final BrokerConfig brokerConfig;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    private static final String BASE_URL = "https://api.kite.trade";
    private String accessToken;
    
    @Override
    public String placeOrder(Order order) {
        if (!isConnected()) {
            throw new RuntimeException("Zerodha not connected. Please authenticate first.");
        }
        
        try {
            log.info("[ZERODHA] Placing order: {} {} {} @ ₹{}", 
                    order.getSide(), order.getQuantity(), order.getSymbol(), order.getLimitPrice());
            
            Map<String, Object> orderParams = new HashMap<>();
            orderParams.put("tradingsymbol", order.getSymbol());
            orderParams.put("exchange", "NSE");
            orderParams.put("transaction_type", order.getSide().name());
            orderParams.put("quantity", order.getQuantity());
            orderParams.put("product", "MIS"); // Intraday
            orderParams.put("order_type", order.getOrderType().name());
            
            if (order.getLimitPrice() != null) {
                orderParams.put("price", order.getLimitPrice());
            }
            
            HttpHeaders headers = createHeaders();
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderParams, headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/orders/regular",
                    HttpMethod.POST,
                    request,
                    String.class
            );
            
            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String orderId = responseBody.get("data").get("order_id").asText();
            
            log.info("[ZERODHA] Order placed successfully: {}", orderId);
            return orderId;
            
        } catch (Exception e) {
            log.error("[ZERODHA] Order placement failed", e);
            throw new RuntimeException("Zerodha order placement failed: " + e.getMessage());
        }
    }
    
    @Override
    public void cancelOrder(String brokerOrderId) {
        if (!isConnected()) {
            throw new RuntimeException("Zerodha not connected");
        }
        
        try {
            log.info("[ZERODHA] Cancelling order: {}", brokerOrderId);
            
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            restTemplate.exchange(
                    BASE_URL + "/orders/regular/" + brokerOrderId,
                    HttpMethod.DELETE,
                    request,
                    String.class
            );
            
            log.info("[ZERODHA] Order cancelled: {}", brokerOrderId);
            
        } catch (Exception e) {
            log.error("[ZERODHA] Order cancellation failed", e);
            throw new RuntimeException("Zerodha order cancellation failed: " + e.getMessage());
        }
    }
    
    @Override
    public OrderStatusResponse getOrderStatus(String brokerOrderId) {
        if (!isConnected()) {
            return OrderStatusResponse.builder()
                    .brokerOrderId(brokerOrderId)
                    .status(OrderStatus.REJECTED)
                    .message("Zerodha not connected")
                    .build();
        }
        
        try {
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/orders/" + brokerOrderId,
                    HttpMethod.GET,
                    request,
                    String.class
            );
            
            JsonNode orderData = objectMapper.readTree(response.getBody()).get("data").get(0);
            
            String status = orderData.get("status").asText();
            OrderStatus orderStatus = mapZerodhaStatus(status);
            
            OrderStatusResponse.OrderStatusResponseBuilder builder = OrderStatusResponse.builder()
                    .brokerOrderId(brokerOrderId)
                    .status(orderStatus);
            
            if (orderData.has("filled_quantity")) {
                builder.filledQuantity(orderData.get("filled_quantity").asInt());
            }
            
            if (orderData.has("average_price")) {
                builder.filledPrice(orderData.get("average_price").asDouble());
            }
            
            if (orderData.has("status_message")) {
                builder.message(orderData.get("status_message").asText());
            }
            
            return builder.build();
            
        } catch (Exception e) {
            log.error("[ZERODHA] Failed to get order status", e);
            return OrderStatusResponse.builder()
                    .brokerOrderId(brokerOrderId)
                    .status(OrderStatus.REJECTED)
                    .message("Failed to get status: " + e.getMessage())
                    .build();
        }
    }
    
    @Override
    public double getCurrentPrice(String symbol) {
        if (!isConnected()) {
            throw new RuntimeException("Zerodha not connected");
        }
        
        try {
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/quote/ltp?i=NSE:" + symbol,
                    HttpMethod.GET,
                    request,
                    String.class
            );
            
            JsonNode data = objectMapper.readTree(response.getBody()).get("data");
            return data.get("NSE:" + symbol).get("last_price").asDouble();
            
        } catch (Exception e) {
            log.error("[ZERODHA] Failed to get price for {}", symbol, e);
            throw new RuntimeException("Failed to get price: " + e.getMessage());
        }
    }
    
    @Override
    public double getAccountBalance() {
        if (!isConnected()) {
            return 0.0;
        }
        
        try {
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/user/margins",
                    HttpMethod.GET,
                    request,
                    String.class
            );
            
            JsonNode data = objectMapper.readTree(response.getBody()).get("data");
            return data.get("equity").get("available").get("cash").asDouble();
            
        } catch (Exception e) {
            log.error("[ZERODHA] Failed to get account balance", e);
            return 0.0;
        }
    }
    
    @Override
    public boolean isConnected() {
        return accessToken != null && !accessToken.isEmpty();
    }
    
    @Override
    public List<BrokerPositionResponse> getPositions() {
        if (!isConnected()) {
            return Collections.emptyList();
        }
        
        try {
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/portfolio/positions",
                    HttpMethod.GET,
                    request,
                    String.class
            );
            
            JsonNode data = objectMapper.readTree(response.getBody()).get("data");
            JsonNode netPositions = data.get("net");
            
            List<BrokerPositionResponse> positions = new ArrayList<>();
            
            for (JsonNode pos : netPositions) {
                int quantity = pos.get("quantity").asInt();
                if (quantity != 0) {
                    positions.add(BrokerPositionResponse.builder()
                            .symbol(pos.get("tradingsymbol").asText())
                            .quantity(quantity)
                            .averagePrice(pos.get("average_price").asDouble())
                            .lastPrice(pos.get("last_price").asDouble())
                            .pnl(pos.get("pnl").asDouble())
                            .product(pos.get("product").asText())
                            .build());
                }
            }
            
            return positions;
            
        } catch (Exception e) {
            log.error("[ZERODHA] Failed to get positions", e);
            return Collections.emptyList();
        }
    }
    
    @Override
    public void squareOffAll() {
        log.warn("[ZERODHA] SQUARE OFF ALL positions - initiating emergency exit");
        
        List<BrokerPositionResponse> positions = getPositions();
        
        for (BrokerPositionResponse position : positions) {
            try {
                String side = position.getQuantity() > 0 ? "SELL" : "BUY";
                int qty = Math.abs(position.getQuantity());
                
                log.info("[ZERODHA] Squaring off {} {} {}", qty, position.getSymbol(), side);
                
                Map<String, Object> orderParams = new HashMap<>();
                orderParams.put("tradingsymbol", position.getSymbol());
                orderParams.put("exchange", "NSE");
                orderParams.put("transaction_type", side);
                orderParams.put("quantity", qty);
                orderParams.put("product", position.getProduct());
                orderParams.put("order_type", "MARKET");
                
                HttpHeaders headers = createHeaders();
                HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderParams, headers);
                
                restTemplate.exchange(
                        BASE_URL + "/orders/regular",
                        HttpMethod.POST,
                        request,
                        String.class
                );
                
                log.info("[ZERODHA] Squared off {}", position.getSymbol());
                
            } catch (Exception e) {
                log.error("[ZERODHA] Failed to square off {}", position.getSymbol(), e);
            }
        }
        
        log.info("[ZERODHA] Square off completed");
    }
    
    @Override
    public void cancelAllOrders() {
        log.warn("[ZERODHA] CANCEL ALL orders - initiating");
        
        try {
            HttpHeaders headers = createHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/orders",
                    HttpMethod.GET,
                    request,
                    String.class
            );
            
            JsonNode orders = objectMapper.readTree(response.getBody()).get("data");
            
            for (JsonNode order : orders) {
                String status = order.get("status").asText();
                if ("OPEN".equals(status) || "TRIGGER PENDING".equals(status)) {
                    String orderId = order.get("order_id").asText();
                    try {
                        cancelOrder(orderId);
                    } catch (Exception e) {
                        log.error("[ZERODHA] Failed to cancel order {}", orderId, e);
                    }
                }
            }
            
            log.info("[ZERODHA] All orders cancelled");
            
        } catch (Exception e) {
            log.error("[ZERODHA] Failed to cancel all orders", e);
        }
    }
    
    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
        log.info("[ZERODHA] Access token configured");
    }
    
    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Kite-Version", "3");
        headers.set("Authorization", "token " + brokerConfig.getZerodha().getApiKey() + ":" + accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
    
    private OrderStatus mapZerodhaStatus(String zerodhaStatus) {
        return switch (zerodhaStatus.toUpperCase()) {
            case "COMPLETE" -> OrderStatus.FILLED;
            case "REJECTED" -> OrderStatus.REJECTED;
            case "CANCELLED" -> OrderStatus.CLOSED;
            case "OPEN", "TRIGGER PENDING" -> OrderStatus.PLACED;
            default -> OrderStatus.PENDING;
        };
    }
}
