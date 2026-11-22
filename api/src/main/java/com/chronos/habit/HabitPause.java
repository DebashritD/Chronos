package com.chronos.habit;

import java.time.LocalDate;

public record HabitPause(long id, long habitId, LocalDate fromDate, LocalDate toDate) {
}
