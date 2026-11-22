package com.chronos.habit;

import com.chronos.habit.domain.Color;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CheckIn(long id, long habitId, LocalDate periodStart, Color color, String note,
                      OffsetDateTime updatedAt) {
}
