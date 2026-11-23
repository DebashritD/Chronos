package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateHabitRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 200) String minText,
        @NotBlank @Size(max = 200) String targetText,
        @NotNull Frequency frequency,
        Integer intervalDays,
        LocalDate startDate,
        Boolean yellowCap) {
}
