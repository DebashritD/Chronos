package com.chronos.stats;

import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record WeekResponse(LocalDate start, LocalDate today, List<Habit> habits, Distribution distribution) {

    public record Habit(long id, String name, String minText, String targetText, Frequency frequency,
                        Integer intervalDays, HabitStatus status, Current current, List<Cell> cells) {
    }

    /** The period containing the user's today, independent of the requested week; null before the first period. */
    public record Current(LocalDate periodStart, CellState state, boolean editable, String note, Instant closesAt) {
    }

    /** {@code closesAt}: midnight (user's zone) after the period's last day; null when {@code periodStart} is null. */
    public record Cell(LocalDate date, LocalDate periodStart, CellState state, boolean editable, String note,
                       Instant closesAt) {
    }
}
