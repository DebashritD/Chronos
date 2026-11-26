package com.chronos.task;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository tasks;
    private final UserService users;
    private final Clock clock;

    public TaskService(TaskRepository tasks, UserService users, Clock clock) {
        this.tasks = tasks;
        this.users = users;
        this.clock = clock;
    }

    public List<Task> list(long userId) {
        return tasks.listFrom(userId, users.today(userId));
    }

    public Task save(long userId, UUID id, TaskRequest body) {
        // One day of slack: a phone ahead of the server's idea of the user's today.
        LocalDate latest = users.today(userId).plusDays(1);
        if (isAfter(body.scheduledOn(), latest) || isAfter(body.doneOn(), latest)) {
            throw new ApiException(ErrorCode.VALIDATION, "Dates can’t be in the future");
        }
        // The phone's own time keeps an offline add (or an Undo) in its place; never later than now.
        Instant now = clock.instant();
        Instant createdAt = body.createdAt() == null || body.createdAt().isAfter(now) ? now : body.createdAt();
        return tasks.upsert(id, userId, body.text().strip(), body.scheduledOn(), body.doneOn(), createdAt)
                .orElseThrow(() -> ApiException.notFound("Task"));
    }

    public void delete(long userId, UUID id) {
        if (tasks.delete(id, userId) == 0 && tasks.exists(id)) {
            throw ApiException.notFound("Task");
        }
    }

    private static boolean isAfter(LocalDate date, LocalDate latest) {
        return date != null && date.isAfter(latest);
    }
}
