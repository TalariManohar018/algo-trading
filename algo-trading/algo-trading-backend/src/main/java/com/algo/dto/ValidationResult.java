package com.algo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResult {
    private boolean valid;
    private List<String> errors;
    private List<String> warnings;
}
