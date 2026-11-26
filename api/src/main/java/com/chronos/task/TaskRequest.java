package com.chronos.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

/** {@code createdAt} is when the phone added the task; optional, and only used on the first save. */
public record TaskRequest(@NotBlank @Size(max = 200) String text, LocalDate scheduledOn, LocalDate doneOn, Instant createdAt) {
}
