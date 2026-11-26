package com.chronos.task;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record Task(UUID id, long userId, String text, LocalDate scheduledOn, LocalDate doneOn, OffsetDateTime createdAt) {
}
