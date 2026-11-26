package com.chronos.task;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TaskResponse(UUID id, String text, LocalDate scheduledOn, LocalDate doneOn, OffsetDateTime createdAt) {
    static TaskResponse from(Task t) {
        return new TaskResponse(t.id(), t.text(), t.scheduledOn(), t.doneOn(), t.createdAt());
    }
}
