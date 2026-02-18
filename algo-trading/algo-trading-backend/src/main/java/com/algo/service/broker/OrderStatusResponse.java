package com.algo.service.broker;

import com.algo.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusResponse {
    private String brokerOrderId;
    private OrderStatus status;
    private Double filledPrice;
    private Integer filledQuantity;
    private String message;
}
