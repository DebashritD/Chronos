package com.chronos.habit.domain;

import java.time.LocalDate;

/** Inclusive date range; {@code to == null} means open-ended. */
public record DateRange(LocalDate from, LocalDate to) {

    public boolean contains(LocalDate date) {
        return !date.isBefore(from) && (to == null || !date.isAfter(to));
    }
}
