package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitSchedule;
import com.chronos.habit.domain.HabitStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record Habit(long id, long userId, String name, String minText, String targetText, Frequency frequency,
                   Integer intervalDays, LocalDate startDate, HabitStatus status, OffsetDateTime createdAt,
                   OffsetDateTime updatedAt, boolean yellowCap) {

    public HabitSchedule schedule() {
        return new HabitSchedule(frequency, intervalDays, startDate);
    }

    public boolean archived() {
        return status == HabitStatus.ARCHIVED;
    }
}
