package com.chronos.stats;

import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

public record MonthResponse(YearMonth month, List<Day> overview, List<Habit> habits, Distribution distribution) {

    public record Day(LocalDate date, Double score) {
    }

    public record Habit(long id, String name, Frequency frequency, List<Cell> cells) {
    }

    public record Cell(LocalDate date, CellState state) {
    }
}
