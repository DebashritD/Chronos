package com.chronos.habit;

import com.chronos.habit.domain.Color;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CheckInRequest(@NotNull Color color, @Size(max = 500) String note) {
}
