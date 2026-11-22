package com.chronos.habit;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
public class HabitService {

    private final HabitRepository habits;
    private final PauseRepository pauses;
    private final UserService userService;

    public HabitService(HabitRepository habits, PauseRepository pauses, UserService userService) {
        this.habits = habits;
        this.pauses = pauses;
        this.userService = userService;
    }

    public Habit requireOwned(long userId, long habitId) {
        return habits.findOwned(userId, habitId).orElseThrow(() -> ApiException.notFound("Habit"));
    }

    public List<Habit> list(long userId, HabitStatus status) {
        Set<HabitStatus> statuses = status == null ? EnumSet.of(HabitStatus.ACTIVE, HabitStatus.PAUSED) : Set.of(status);
        return habits.findByUser(userId, statuses);
    }

    @Transactional
    public Habit create(long userId, CreateHabitRequest request) {
        LocalDate today = userService.today(userId);
        LocalDate startDate = request.startDate() == null ? today : request.startDate();
        if (startDate.isAfter(today)) {
            throw validation("startDate: may not be in the future");
        }
        Integer interval = request.intervalDays();
        if (request.frequency() == Frequency.EVERY_N_DAYS) {
            if (interval == null || interval < 2 || interval > 365) {
                throw validation("intervalDays: must be between 2 and 365");
            }
        } else if (interval != null) {
            throw validation("intervalDays: only allowed for EVERY_N_DAYS");
        }
        long id = habits.insert(userId, request.name().strip(), request.minText().strip(),
                request.targetText().strip(), request.frequency(), interval, startDate);
        return requireOwned(userId, id);
    }

    @Transactional
    public Habit update(long userId, long habitId, UpdateHabitRequest request) {
        requireOwned(userId, habitId);
        habits.updateTexts(habitId, request.name().strip(), request.minText().strip(), request.targetText().strip());
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit pause(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.ACTIVE);
        pauses.open(habitId, userService.today(userId));
        habits.updateStatus(habitId, HabitStatus.PAUSED);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit resume(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.PAUSED);
        closeOpenPause(userId, habitId);
        habits.updateStatus(habitId, HabitStatus.ACTIVE);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit archive(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        if (habit.archived()) {
            throw invalidState(habit);
        }
        if (pauses.findOpen(habitId).isEmpty()) {
            pauses.open(habitId, userService.today(userId));
        }
        habits.updateStatus(habitId, HabitStatus.ARCHIVED);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit unarchive(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.ARCHIVED);
        closeOpenPause(userId, habitId);
        habits.updateStatus(habitId, HabitStatus.ACTIVE);
        return requireOwned(userId, habitId);
    }

    /** Ends the open pause yesterday, or drops it if it only started today. */
    private void closeOpenPause(long userId, long habitId) {
        LocalDate today = userService.today(userId);
        pauses.findOpen(habitId).ifPresent(pause -> {
            if (pause.fromDate().isBefore(today)) {
                pauses.close(pause.id(), today.minusDays(1));
            } else {
                pauses.delete(pause.id());
            }
        });
    }

    private static void requireStatus(Habit habit, HabitStatus expected) {
        if (habit.status() != expected) {
            throw invalidState(habit);
        }
    }

    private static ApiException invalidState(Habit habit) {
        return new ApiException(ErrorCode.INVALID_STATE, "Habit is " + habit.status());
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, message);
    }
}
