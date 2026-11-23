package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HabitResponse(long id, String name, String minText, String targetText, Frequency frequency,
                            Integer intervalDays, LocalDate startDate, HabitStatus status,
                            boolean yellowCap) {

    public static HabitResponse from(Habit h) {
        return new HabitResponse(h.id(), h.name(), h.minText(), h.targetText(), h.frequency(), h.intervalDays(),
                h.startDate(), h.status(), h.yellowCap());
    }
}
