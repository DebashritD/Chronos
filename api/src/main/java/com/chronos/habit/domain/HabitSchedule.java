package com.chronos.habit.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Splits time into a habit's periods. Every period is identified by its first day. */
public record HabitSchedule(Frequency frequency, Integer intervalDays, LocalDate startDate) {

    public HabitSchedule {
        Objects.requireNonNull(frequency, "frequency");
        Objects.requireNonNull(startDate, "startDate");
        if (frequency == Frequency.EVERY_N_DAYS && (intervalDays == null || intervalDays < 2)) {
            throw new IllegalArgumentException("EVERY_N_DAYS needs intervalDays >= 2");
        }
    }

    public LocalDate firstPeriodStart() {
        return frequency == Frequency.WEEKLY
                ? startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                : startDate;
    }

    public int periodLength() {
        return switch (frequency) {
            case DAILY -> 1;
            case EVERY_N_DAYS -> intervalDays;
            case WEEKLY -> 7;
        };
    }

    /** Start of the period containing {@code date}, or empty if {@code date} is before the first period. */
    public Optional<LocalDate> periodContaining(LocalDate date) {
        LocalDate first = firstPeriodStart();
        if (date.isBefore(first)) {
            return Optional.empty();
        }
        long offset = ChronoUnit.DAYS.between(first, date) % periodLength();
        return Optional.of(date.minusDays(offset));
    }

    public boolean isPeriodStart(LocalDate date) {
        return periodContaining(date).filter(date::equals).isPresent();
    }

    public LocalDate periodEnd(LocalDate periodStart) {
        return periodStart.plusDays(periodLength() - 1L);
    }

    /** Period starts {@code s} with {@code from <= s <= to}, ascending. */
    public List<LocalDate> periodStartsBetween(LocalDate from, LocalDate to) {
        List<LocalDate> starts = new ArrayList<>();
        LocalDate first = firstPeriodStart();
        LocalDate start = from.isBefore(first) ? first : periodContaining(from).orElseThrow();
        if (start.isBefore(from)) {
            start = start.plusDays(periodLength());
        }
        for (; !start.isAfter(to); start = start.plusDays(periodLength())) {
            starts.add(start);
        }
        return starts;
    }
}
