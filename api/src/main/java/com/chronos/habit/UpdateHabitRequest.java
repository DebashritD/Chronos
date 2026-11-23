package com.chronos.habit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateHabitRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 200) String minText,
        @NotBlank @Size(max = 200) String targetText,
        Boolean yellowCap) {
}
