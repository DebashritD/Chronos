package com.chronos.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TaskRequest(@NotBlank @Size(max = 200) String text, LocalDate scheduledOn, LocalDate doneOn) {
}
