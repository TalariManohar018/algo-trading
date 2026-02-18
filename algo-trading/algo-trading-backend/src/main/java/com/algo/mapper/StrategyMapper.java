package com.algo.mapper;

import com.algo.dto.*;
import com.algo.enums.ConditionLogic;
import com.algo.model.RiskConfig;
import com.algo.model.Strategy;
import com.algo.model.StrategyCondition;
import com.algo.model.TradingWindow;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class StrategyMapper {
    
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    
    public Strategy toEntity(CreateStrategyRequest request) {
        Strategy strategy = new Strategy();
        strategy.setName(request.getName());
        strategy.setDescription(request.getDescription());
        strategy.setSymbol(request.getSymbol());
        strategy.setInstrumentType(request.getInstrumentType());
        strategy.setTimeframe(request.getTimeframe());
        strategy.setQuantity(request.getQuantity());
        strategy.setOrderType(request.getOrderType());
        strategy.setProductType(request.getProductType());
        
        // Map entry conditions
        List<StrategyCondition> entryConditions = request.getEntryConditions().stream()
                .map(this::toConditionEntity)
                .collect(Collectors.toList());
        strategy.setEntryConditions(entryConditions);
        
        // Map exit conditions
        if (request.getExitConditions() != null && !request.getExitConditions().isEmpty()) {
            List<StrategyCondition> exitConditions = request.getExitConditions().stream()
                    .map(this::toConditionEntity)
                    .collect(Collectors.toList());
            strategy.setExitConditions(exitConditions);
        }
        
        strategy.setMaxTradesPerDay(request.getMaxTradesPerDay());
        
        // Map trading window
        TradingWindow tradingWindow = new TradingWindow();
        tradingWindow.setStartTime(LocalTime.parse(request.getTradingWindow().getStartTime(), TIME_FORMATTER));
        tradingWindow.setEndTime(LocalTime.parse(request.getTradingWindow().getEndTime(), TIME_FORMATTER));
        strategy.setTradingWindow(tradingWindow);
        
        strategy.setSquareOffTime(LocalTime.parse(request.getSquareOffTime(), TIME_FORMATTER));
        
        // Map risk config
        RiskConfig riskConfig = new RiskConfig();
        riskConfig.setMaxLossPerTrade(request.getRiskConfig().getMaxLossPerTrade());
        riskConfig.setMaxProfitTarget(request.getRiskConfig().getMaxProfitTarget());
        riskConfig.setStopLossPercent(request.getRiskConfig().getStopLossPercent());
        riskConfig.setTakeProfitPercent(request.getRiskConfig().getTakeProfitPercent());
        strategy.setRiskConfig(riskConfig);
        
        return strategy;
    }
    
    public StrategyResponse toResponse(Strategy strategy) {
        StrategyResponse response = new StrategyResponse();
        response.setId(strategy.getId());
        response.setName(strategy.getName());
        response.setDescription(strategy.getDescription());
        response.setSymbol(strategy.getSymbol());
        response.setInstrumentType(strategy.getInstrumentType());
        response.setTimeframe(strategy.getTimeframe());
        response.setQuantity(strategy.getQuantity());
        response.setOrderType(strategy.getOrderType());
        response.setProductType(strategy.getProductType());
        
        // Map entry conditions
        List<StrategyConditionDTO> entryConditions = strategy.getEntryConditions().stream()
                .map(this::toConditionDTO)
                .collect(Collectors.toList());
        response.setEntryConditions(entryConditions);
        
        // Map exit conditions
        if (strategy.getExitConditions() != null && !strategy.getExitConditions().isEmpty()) {
            List<StrategyConditionDTO> exitConditions = strategy.getExitConditions().stream()
                    .map(this::toConditionDTO)
                    .collect(Collectors.toList());
            response.setExitConditions(exitConditions);
        }
        
        response.setMaxTradesPerDay(strategy.getMaxTradesPerDay());
        
        // Map trading window
        if (strategy.getTradingWindow() != null) {
            TradingWindowDTO tradingWindowDTO = new TradingWindowDTO();
            tradingWindowDTO.setStartTime(strategy.getTradingWindow().getStartTime().format(TIME_FORMATTER));
            tradingWindowDTO.setEndTime(strategy.getTradingWindow().getEndTime().format(TIME_FORMATTER));
            response.setTradingWindow(tradingWindowDTO);
        }
        
        if (strategy.getSquareOffTime() != null) {
            response.setSquareOffTime(strategy.getSquareOffTime().format(TIME_FORMATTER));
        }
        
        // Map risk config
        if (strategy.getRiskConfig() != null) {
            RiskConfigDTO riskConfigDTO = new RiskConfigDTO();
            riskConfigDTO.setMaxLossPerTrade(strategy.getRiskConfig().getMaxLossPerTrade());
            riskConfigDTO.setMaxProfitTarget(strategy.getRiskConfig().getMaxProfitTarget());
            riskConfigDTO.setStopLossPercent(strategy.getRiskConfig().getStopLossPercent());
            riskConfigDTO.setTakeProfitPercent(strategy.getRiskConfig().getTakeProfitPercent());
            response.setRiskConfig(riskConfigDTO);
        }
        
        response.setStatus(strategy.getStatus());
        response.setCreatedAt(strategy.getCreatedAt());
        response.setUpdatedAt(strategy.getUpdatedAt());
        
        return response;
    }
    
    private StrategyCondition toConditionEntity(StrategyConditionDTO dto) {
        StrategyCondition condition = new StrategyCondition();
        condition.setConditionId(dto.getId());
        condition.setIndicatorType(dto.getIndicatorType());
        condition.setConditionType(dto.getConditionType());
        condition.setConditionValue(dto.getValue());
        condition.setLogic(dto.getLogic() != null ? dto.getLogic() : ConditionLogic.AND);
        condition.setPeriod(dto.getPeriod());
        return condition;
    }
    
    private StrategyConditionDTO toConditionDTO(StrategyCondition condition) {
        StrategyConditionDTO dto = new StrategyConditionDTO();
        dto.setId(condition.getConditionId());
        dto.setIndicatorType(condition.getIndicatorType());
        dto.setConditionType(condition.getConditionType());
        dto.setValue(condition.getConditionValue());
        dto.setLogic(condition.getLogic());
        dto.setPeriod(condition.getPeriod());
        return dto;
    }
}
