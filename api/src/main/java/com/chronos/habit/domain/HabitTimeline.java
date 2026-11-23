package com.chronos.habit.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;

/** One habit's periods, pauses and check-ins as seen on {@code today} (in the user's timezone). */
public final class HabitTimeline {

    static final int EDIT_WINDOW_DAYS = 7;

    private final HabitSchedule schedule;
    private final List<DateRange> pauses;
    private final Map<LocalDate, Color> colors;
    private final boolean archived;
    private final LocalDate today;

    public HabitTimeline(HabitSchedule schedule, List<DateRange> pauses, Map<LocalDate, Color> colors,
                         boolean archived, LocalDate today) {
        this.schedule = schedule;
        this.pauses = List.copyOf(pauses);
        this.colors = Map.copyOf(colors);
        this.archived = archived;
        this.today = today;
    }

    public HabitSchedule schedule() {
        return schedule;
    }

    public boolean isPaused(LocalDate periodStart) {
        return pauses.stream().anyMatch(p -> p.contains(periodStart));
    }

    public CellState stateOf(LocalDate periodStart) {
        Color color = colors.get(periodStart);
        if (color != null) {
            return CellState.of(color);
        }
        if (isPaused(periodStart)) {
            return CellState.PAUSED;
        }
        if (!schedule.periodEnd(periodStart).isBefore(today)) {
            return CellState.PENDING;
        }
        return CellState.GREY;
    }

    public boolean isEditable(LocalDate periodStart) {
        return !archived
                && schedule.isPeriodStart(periodStart)
                && !periodStart.isAfter(today)
                && !schedule.periodEnd(periodStart).isBefore(today.minusDays(EDIT_WINDOW_DAYS))
                && !isPaused(periodStart);
    }

    /** {@code date} itself when a period starts on it; used for per-day cells of DAILY and EVERY_N_DAYS habits. */
    public Optional<LocalDate> dueOn(LocalDate date) {
        return schedule.isPeriodStart(date) ? Optional.of(date) : Optional.empty();
    }

    /** {@code maxYellows} caps consecutive yellows: one more starts a new streak at 1. Null means no cap. */
    public Streak streak(Integer maxYellows) {
        int current = 0;
        int best = 0;
        int yellowRun = 0;
        for (LocalDate start : schedule.periodStartsBetween(schedule.firstPeriodStart(), today)) {
            switch (stateOf(start)) {
                case GREEN -> {
                    current++;
                    yellowRun = 0;
                }
                case YELLOW -> {
                    yellowRun++;
                    if (maxYellows != null && yellowRun > maxYellows) {
                        current = 1;
                        yellowRun = 1;
                    } else {
                        current++;
                    }
                }
                case RED, GREY -> {
                    current = 0;
                    yellowRun = 0;
                }
                case PAUSED, PENDING, NOT_DUE -> {
                }
            }
            best = Math.max(best, current);
        }
        return new Streak(current, best, yellowRun);
    }

    public Distribution distribution(LocalDate from, LocalDate to) {
        Distribution result = Distribution.EMPTY;
        for (LocalDate start : schedule.periodStartsBetween(from, to)) {
            result = result.plus(stateOf(start));
        }
        return result;
    }

    /** GREEN 2, YELLOW 1, RED/GREY 0 for the period covering {@code date}; empty if it doesn't count. */
    public OptionalInt scoreOn(LocalDate date) {
        Optional<LocalDate> start = schedule.periodContaining(date);
        if (start.isEmpty()) {
            return OptionalInt.empty();
        }
        return switch (stateOf(start.get())) {
            case GREEN -> OptionalInt.of(2);
            case YELLOW -> OptionalInt.of(1);
            case RED, GREY -> OptionalInt.of(0);
            case PAUSED, PENDING, NOT_DUE -> OptionalInt.empty();
        };
    }

    /** Mean score (0-2) over the habits that count on {@code date}, or null if none do. */
    public static Double averageScore(Collection<HabitTimeline> timelines, LocalDate date) {
        var stats = timelines.stream()
                .map(t -> t.scoreOn(date))
                .filter(OptionalInt::isPresent)
                .mapToInt(OptionalInt::getAsInt)
                .summaryStatistics();
        return stats.getCount() == 0 ? null : stats.getAverage();
    }
}
