package com.chronos.stats;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import com.chronos.habit.CheckInRepository;
import com.chronos.habit.Habit;
import com.chronos.habit.HabitService;
import com.chronos.habit.HabitTimelines;
import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitTimeline;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StatsService {

    private final HabitService habitService;
    private final HabitTimelines timelines;
    private final CheckInRepository checkIns;
    private final UserService userService;

    public StatsService(HabitService habitService, HabitTimelines timelines, CheckInRepository checkIns,
                        UserService userService) {
        this.habitService = habitService;
        this.timelines = timelines;
        this.checkIns = checkIns;
        this.userService = userService;
    }

    public WeekResponse week(long userId, LocalDate requestedStart) {
        LocalDate today = userService.today(userId);
        LocalDate start = requestedStart == null
                ? today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                : requestedStart;
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new ApiException(ErrorCode.VALIDATION, "start: must be a Monday");
        }
        LocalDate end = start.plusDays(6);
        ZoneId zone = ZoneId.of(userService.get(userId).timezone());
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);
        Map<Long, LocalDate> currentStarts = new HashMap<>();
        byId.forEach((id, timeline) -> timeline.schedule().periodContaining(today)
                .ifPresent(periodStart -> currentStarts.put(id, periodStart)));
        // One notes query covering both the requested week and every current period.
        LocalDate notesFrom = currentStarts.values().stream().reduce(start, (a, b) -> a.isBefore(b) ? a : b);
        LocalDate notesTo = end.isAfter(today) ? end : today;
        var notes = checkIns.notesBetween(byId.keySet(), notesFrom, notesTo);

        List<WeekResponse.Habit> rows = new ArrayList<>();
        Distribution distribution = Distribution.EMPTY;
        for (Habit habit : habits) {
            HabitTimeline timeline = byId.get(habit.id());
            Map<LocalDate, String> habitNotes = notes.getOrDefault(habit.id(), Map.of());
            List<LocalDate> days = habit.frequency() == Frequency.WEEKLY
                    ? List.of(start)
                    : start.datesUntil(end.plusDays(1)).toList();
            List<WeekResponse.Cell> cells = days.stream()
                    .map(day -> timeline.dueOn(day)
                            .map(p -> new WeekResponse.Cell(day, p, timeline.stateOf(p), timeline.isEditable(p),
                                    habitNotes.get(p), closesAt(timeline, p, zone)))
                            .orElseGet(() -> new WeekResponse.Cell(day, null, CellState.NOT_DUE, false, null, null)))
                    .toList();
            LocalDate currentStart = currentStarts.get(habit.id());
            WeekResponse.Current current = currentStart == null ? null
                    : new WeekResponse.Current(currentStart, timeline.stateOf(currentStart),
                            timeline.isEditable(currentStart), habitNotes.get(currentStart),
                            closesAt(timeline, currentStart, zone));
            rows.add(new WeekResponse.Habit(habit.id(), habit.name(), habit.minText(), habit.targetText(),
                    habit.frequency(), habit.intervalDays(), current, cells));
            distribution = distribution.plus(timeline.distribution(start, end));
        }
        return new WeekResponse(start, today, rows, distribution);
    }

    public MonthResponse month(long userId, String requestedMonth) {
        LocalDate today = userService.today(userId);
        YearMonth month = parseMonth(requestedMonth, today);
        LocalDate first = month.atDay(1);
        LocalDate last = month.atEndOfMonth();
        List<LocalDate> days = first.datesUntil(last.plusDays(1)).toList();
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);

        List<MonthResponse.Day> overview = days.stream()
                .map(day -> new MonthResponse.Day(day, HabitTimeline.averageScore(byId.values(), day)))
                .toList();

        List<MonthResponse.Habit> rows = new ArrayList<>();
        Distribution distribution = Distribution.EMPTY;
        for (Habit habit : habits) {
            HabitTimeline timeline = byId.get(habit.id());
            List<MonthResponse.Cell> cells = days.stream()
                    .map(day -> new MonthResponse.Cell(day, monthState(habit, timeline, day)))
                    .toList();
            rows.add(new MonthResponse.Habit(habit.id(), habit.name(), habit.frequency(), cells));
            distribution = distribution.plus(timeline.distribution(first, last));
        }
        return new MonthResponse(month, overview, rows, distribution);
    }

    public List<StreakResponse> streaks(long userId) {
        LocalDate today = userService.today(userId);
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);
        return habits.stream()
                .map(h -> {
                    var streak = byId.get(h.id()).streak();
                    return new StreakResponse(h.id(), h.name(), streak.current(), streak.best());
                })
                .toList();
    }

    /** Midnight in the user's zone after the period's last day, i.e. when the period stops being current. */
    private static Instant closesAt(HabitTimeline timeline, LocalDate periodStart, ZoneId zone) {
        return timeline.schedule().periodEnd(periodStart).plusDays(1).atStartOfDay(zone).toInstant();
    }

    /** WEEKLY habits show their week's state on every day; others show the state on due days only. */
    private static CellState monthState(Habit habit, HabitTimeline timeline, LocalDate day) {
        var periodStart = habit.frequency() == Frequency.WEEKLY
                ? timeline.schedule().periodContaining(day)
                : timeline.dueOn(day);
        return periodStart.map(timeline::stateOf).orElse(CellState.NOT_DUE);
    }

    private static YearMonth parseMonth(String value, LocalDate today) {
        if (value == null) {
            return YearMonth.from(today);
        }
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException ex) {
            throw new ApiException(ErrorCode.VALIDATION, "month: expected YYYY-MM");
        }
    }
}
