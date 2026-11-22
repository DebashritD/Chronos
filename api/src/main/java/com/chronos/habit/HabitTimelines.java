package com.chronos.habit;

import com.chronos.habit.domain.HabitTimeline;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds {@link HabitTimeline}s for habits with two queries (pauses, check-ins) regardless of habit count. */
@Component
public class HabitTimelines {

    private final PauseRepository pauses;
    private final CheckInRepository checkIns;

    public HabitTimelines(PauseRepository pauses, CheckInRepository checkIns) {
        this.pauses = pauses;
        this.checkIns = checkIns;
    }

    public Map<Long, HabitTimeline> load(List<Habit> habits, LocalDate today) {
        List<Long> ids = habits.stream().map(Habit::id).toList();
        var pausesByHabit = pauses.rangesByHabit(ids);
        var colorsByHabit = checkIns.colorsByHabit(ids);
        Map<Long, HabitTimeline> result = new LinkedHashMap<>();
        for (Habit habit : habits) {
            result.put(habit.id(), new HabitTimeline(habit.schedule(),
                    pausesByHabit.getOrDefault(habit.id(), List.of()),
                    colorsByHabit.getOrDefault(habit.id(), Map.of()),
                    habit.archived(), today));
        }
        return result;
    }
}
