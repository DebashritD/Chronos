package com.chronos.habit;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class CheckInService {

    private final HabitService habits;
    private final HabitTimelines timelines;
    private final CheckInRepository checkIns;
    private final UserService userService;

    public CheckInService(HabitService habits, HabitTimelines timelines, CheckInRepository checkIns,
                          UserService userService) {
        this.habits = habits;
        this.timelines = timelines;
        this.checkIns = checkIns;
        this.userService = userService;
    }

    @Transactional
    public CheckIn mark(long userId, long habitId, LocalDate periodStart, CheckInRequest request) {
        requireEditable(userId, habitId, periodStart);
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        return checkIns.upsert(habitId, periodStart, request.color(), note);
    }

    @Transactional
    public void clear(long userId, long habitId, LocalDate periodStart) {
        requireEditable(userId, habitId, periodStart);
        checkIns.delete(habitId, periodStart);
    }

    private void requireEditable(long userId, long habitId, LocalDate periodStart) {
        Habit habit = habits.requireOwned(userId, habitId);
        var timeline = timelines.load(List.of(habit), userService.today(userId)).get(habitId);
        if (!timeline.isEditable(periodStart)) {
            throw new ApiException(ErrorCode.CHECK_IN_NOT_ALLOWED,
                    "This period can't be changed (outside the last 7 days, not a period start, or paused)");
        }
    }
}
