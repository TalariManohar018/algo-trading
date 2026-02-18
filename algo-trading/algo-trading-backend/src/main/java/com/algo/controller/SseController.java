package com.algo.controller;

import com.algo.service.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/sse")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class SseController {
    
    private final SseService sseService;
    
    /**
     * Subscribe to real-time updates
     */
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@RequestParam(required = false, defaultValue = "1") String userId) {
        log.info("New SSE connection request from user: {}", userId);
        return sseService.createEmitter(userId);
    }
}
