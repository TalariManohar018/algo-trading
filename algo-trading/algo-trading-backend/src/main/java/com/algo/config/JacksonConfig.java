package com.algo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * Jackson configuration for REST API endpoints.
 * This ObjectMapper is used for HTTP message conversion (request/response).
 * It does NOT have polymorphic type handling, unlike the Redis ObjectMapper.
 */
@Configuration
public class JacksonConfig {
    
    /**
     * Primary ObjectMapper for REST endpoints - no polymorphic type handling
     */
    @Bean
    @Primary
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper mapper = builder.createXmlMapper(false).build();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // No polymorphic type handling - DTOs don't need @class property
        return mapper;
    }
}
